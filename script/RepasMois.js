/**
 * Menu « Repas par mois » : écrit l'onglet « Repas / Mois », le bilan des
 * repas de groupe mois par mois, lu dans « Journal Repas ».
 *
 * Pour chaque mois (le plus récent en haut) : un tableau avec une ligne par
 * plat servi ce mois-là (repas, personnes, recette, dépenses, revenu net, par
 * personne), une ligne Total, puis une phrase de bilan.
 *
 * Le script ne pose que la charpente (quels mois, quels plats) ; tous les
 * chiffres sont des formules qui cherchent dans « Journal Repas » par la
 * date et le nom du plat. Corriger une ligne du journal corrige le bilan tout
 * de suite. Un mois ou un plat nouveau demande de relancer le menu : la
 * ligne 2 le signale (repas du journal qui ne sont comptés nulle part).
 *
 * Les colonnes du journal sont retrouvées par leur en-tête, pas par leur place.
 */

const FEUILLE_REPAS = 'Journal Repas';
const FEUILLE_REPAS_MOIS = 'Repas / Mois';
const TITRE_REPAS_MOIS = 'Repas par mois';
const ENTETES_REPAS_MOIS = ['Plat', 'Repas', 'Personnes', 'Recette (DH)', 'Dépenses (DH)',
  'Revenu net (DH)', 'Recette / personne', 'Net / personne'];

// Journal Repas : clé → en-tête attendu (sans accents ni majuscules).
const COLONNES_REPAS = {
  date: 'date', plat: 'description', depenses: 'depenses', extras: 'depenses extras',
  recette: 'produits', personnes: 'nbre de personne',
};

const sansAccent_ = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const nomPlat_ = (s) => { const t = String(s).trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
const lettreCol_ = (n) => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

function construireRepasMois() {
  const ss = SpreadsheetApp.getActive();
  const j = ss.getSheetByName(FEUILLE_REPAS);
  if (!j) throw new Error(`Onglet « ${FEUILLE_REPAS} » introuvable.`);

  // 1. Les colonnes du journal, par leur en-tête.
  const entetes = j.getRange(1, 1, 1, j.getLastColumn()).getValues()[0].map(sansAccent_);
  const col = {};
  for (const [cle, nom] of Object.entries(COLONNES_REPAS)) {
    const i = entetes.indexOf(nom);
    if (i < 0) throw new Error(`« ${FEUILLE_REPAS} » : colonne « ${nom} » introuvable en ligne 1.`);
    col[cle] = `'${FEUILLE_REPAS}'!$${lettreCol_(i + 1)}:$${lettreCol_(i + 1)}`;
  }

  // 2. Les mois et les plats servis chaque mois.
  const n = Math.max(j.getLastRow() - 1, 0);
  const lignes = n ? j.getRange(2, 1, n, j.getLastColumn()).getValues() : [];
  const iDate = entetes.indexOf(COLONNES_REPAS.date);
  const iPlat = entetes.indexOf(COLONNES_REPAS.plat);
  const mois = new Map(); // « 2026-10 » → { debut, plats: Set }
  const sansDate = [];
  lignes.forEach((l, k) => {
    const d = l[iDate], plat = String(l[iPlat]).trim();
    if (!plat) return; // sans nom : compté nulle part, la ligne 2 le signale
    if (Object.prototype.toString.call(d) !== '[object Date]') { sansDate.push(k + 2); return; }
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!mois.has(cle)) mois.set(cle, { debut: new Date(d.getFullYear(), d.getMonth(), 1), plats: new Set() });
    mois.get(cle).plats.add(nomPlat_(plat));
  });

  // 3. L'onglet : jamais par-dessus un contenu qui n'est pas de ce menu.
  let f = ss.getSheetByName(FEUILLE_REPAS_MOIS);
  if (f) {
    const a1 = String(f.getRange(1, 1).getValue()).trim();
    if (a1 && a1 !== TITRE_REPAS_MOIS) {
      throw new Error(`L'onglet « ${FEUILLE_REPAS_MOIS} » contient déjà autre chose (A1 = « ${a1} »). Renommez-le, puis relancez.`);
    }
  } else {
    f = ss.insertSheet(FEUILLE_REPAS_MOIS, j.getIndex());
  }
  f.getRange(1, 1, f.getMaxRows(), f.getMaxColumns()).clearContent();
  SEP = separateur_(f);

  // 4. Écrire les blocs, le mois le plus récent en haut.
  const nbCol = ENTETES_REPAS_MOIS.length;
  const blocs = [...mois.keys()].sort().reverse().map((k) => mois.get(k));
  const nbLignes = 3 + blocs.reduce((s, b) => s + b.plats.size + 5, 0);
  if (f.getMaxRows() < nbLignes) f.insertRowsAfter(f.getMaxRows(), nbLignes - f.getMaxRows());

  f.getRange(1, 1).setValue(TITRE_REPAS_MOIS).setFontWeight('bold').setFontSize(14);
  f.getRange(1, 2).setValue(`Calculé depuis « ${FEUILLE_REPAS} ». Nouveau mois ou nouveau plat : menu Snack → Repas par mois.`)
    .setFontColor('#666666');

  let r = 4;
  const totaux = [];
  for (const b of blocs) {
    const t = r; // ligne du titre : sa case A porte le 1er du mois, les formules la lisent
    f.getRange(t, 1).setValue(b.debut).setNumberFormat('mmmm yyyy').setFontWeight('bold').setFontSize(12);
    f.getRange(t, 1, 1, nbCol).setBackground('#cfe2f3');
    f.getRange(t + 1, 1, 1, nbCol).setValues([ENTETES_REPAS_MOIS]).setFontWeight('bold').setBackground('#eeeeee');

    const plats = [...b.plats].sort((x, y) => x.localeCompare(y, 'fr'));
    const p1 = t + 2, pn = t + 1 + plats.length, tot = pn + 1;
    const ceMois = (ligne) => `${col.date},">="&$A$${t},${col.date},"<"&EDATE($A$${t},1),${col.plat},$A${ligne}`;
    plats.forEach((plat, i) => {
      const l = p1 + i;
      f.getRange(l, 1).setValue(plat);
      f.getRange(l, 2, 1, nbCol - 1).setFormulas([[
        `=COUNTIFS(${ceMois(l)})`,
        `=SUMIFS(${col.personnes},${ceMois(l)})`,
        `=SUMIFS(${col.recette},${ceMois(l)})`,
        `=SUMIFS(${col.depenses},${ceMois(l)})+SUMIFS(${col.extras},${ceMois(l)})`,
        `=D${l}-E${l}`,
        `=IF(C${l}=0,"",D${l}/C${l})`,
        `=IF(C${l}=0,"",F${l}/C${l})`,
      ].map(fx_)]);
    });

    f.getRange(tot, 1).setValue('Total');
    f.getRange(tot, 2, 1, nbCol - 1).setFormulas([[
      ...['B', 'C', 'D', 'E', 'F'].map((c) => `=SUM(${c}${p1}:${c}${pn})`),
      `=IF(C${tot}=0,"",D${tot}/C${tot})`,
      `=IF(C${tot}=0,"",F${tot}/C${tot})`,
    ].map(fx_)]);
    f.getRange(tot, 1, 1, nbCol).setFontWeight('bold');
    totaux.push(`B${tot}`);

    // La phrase de bilan : pas de virgule dans les textes (fx_ les changerait en « ; »).
    const nets = `F${p1}:F${pn}`, noms = `A${p1}:A${pn}`;
    f.getRange(tot + 1, 1).setFormula(fx_(
      `="Bilan : "&B${tot}&" repas · "&C${tot}&" personnes · recette "&TEXT(D${tot},"0")&" DH`
      + ` · dépenses "&TEXT(E${tot},"0")&" DH · revenu net "&TEXT(F${tot},"0")&" DH`
      + ` · le plus rentable : "&INDEX(${noms},MATCH(MAX(${nets}),${nets},0))`
      + `&IF(COUNTIF(${nets},"<0")=0,""," · à perte : "&TEXTJOIN(" et ",TRUE,FILTER(${noms},${nets}<0)))`))
      .setFontStyle('italic');

    f.getRange(p1, 2, tot - p1 + 1, 2).setNumberFormat('0');
    f.getRange(p1, 4, tot - p1 + 1, 3).setNumberFormat('#,##0');
    f.getRange(p1, 7, tot - p1 + 1, 2).setNumberFormat('0');
    r = tot + 3;
  }

  // 5. Ligne 2 : les repas du journal qui ne sont comptés dans aucun bloc.
  const compte = totaux.length ? totaux.join('+') : '0';
  f.getRange(2, 1).setFormula(fx_(
    `=IF(COUNT(${col.date})-(${compte})=0,"","⚠ "&(COUNT(${col.date})-(${compte}))`
    + `&" repas du journal ne sont comptés nulle part : relancer Snack → Repas par mois")`))
    .setFontColor('#cc0000').setFontWeight('bold');

  f.setFrozenRows(1);
  f.setColumnWidth(1, 160);
  for (let c = 2; c <= nbCol; c++) f.setColumnWidth(c, 115);

  SpreadsheetApp.getUi().alert(
    `Onglet « ${FEUILLE_REPAS_MOIS} » écrit : ${blocs.length} mois.`
    + (sansDate.length ? `\n\nLignes du journal sans date lisible (non comptées) : ${sansDate.join(', ')}.` : ''));
  return blocs.length;
}
