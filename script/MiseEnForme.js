/**
 * Menu « Mettre en forme la fiche » : rend « Items & Sandwichs » lisible et
 * construit l'onglet « Plats », un tableau triable d'un plat par ligne.
 *
 * Dans « Items & Sandwichs » :
 *   - les lignes vides ou en double sous le bloc sont retirées (« Benefice »,
 *     « Part Vendeur », « Part Hotel » si elles sont vides, « Revenu » qui
 *     répète « Marge (DH) ») ;
 *   - les quantités utilisées ressortent en vert, les zéros s'effacent (règles
 *     posées par mettreAJour(), qui remplace toutes les règles de l'onglet) ;
 *   - les noms de plats et les colonnes A à E restent visibles au défilement.
 * La disposition ne change pas : noms en ligne 2, libellés en colonne E. Les
 * recherches de « Carte appli » et le script continuent de s'y retrouver.
 *
 * « Plats » : une ligne par produit de la fiche, puis par boisson. Toutes
 * les cases sont des RECHERCHES par le nom en colonne A, la même formule
 * sur chaque ligne : on peut trier, filtrer, et pour un nouveau plat taper
 * son nom en A et tirer les formules de la ligne du dessus (ou relancer).
 * On ne saisit rien dans « Plats » : les recettes et les prix se changent
 * dans « Items & Sandwichs » et « Boissons ».
 */

const FEUILLE_PLATS = 'Plats';
const ENTETES_PLATS = ['Plat', 'Famille', 'Ingrédients', 'Coût revient', 'Prix de vente',
  'Marge (DH)', 'Coût / prix', 'Prix conseillé', 'Part vendeur', 'Pour le vendeur (DH)'];
// Retirées seulement si toutes leurs cases sont vides.
const LIGNES_VIDES_A_RETIRER = ['Benefice', 'Part Vendeur', 'Part Hotel'];
// Retirée même remplie : elle répète « Marge (DH) ».
const LIGNES_EN_DOUBLE = ['Revenu'];

function mettreEnForme() {
  const f = feuille_();
  const der = derniereLigneIngredient_(f);
  const derCol = derniereColonneProduit_(f);
  const nb = derCol - COL_PRODUITS + 1;

  // 1. Lignes inutiles, du bas vers le haut pour ne pas décaler les suivantes.
  const zone = f.getRange(der + 1, COL_LIBELLES, f.getMaxRows() - der, nb + 1).getValues();
  const retirees = [];
  for (let i = zone.length - 1; i >= 0; i--) {
    const libelle = String(zone[i][0]).trim();
    const vide = zone[i].slice(1).every((v) => v === '');
    if (LIGNES_EN_DOUBLE.includes(libelle) || (LIGNES_VIDES_A_RETIRER.includes(libelle) && vide)) {
      f.deleteRow(der + 1 + i);
      retirees.push(libelle);
    }
  }

  // 2. Calculs et couleurs de la grille, puis volets figés.
  mettreAJour();
  f.setFrozenRows(LIGNE_ENTETE);
  f.setFrozenColumns(COL_LIBELLES);

  // 3. L'onglet « Plats ».
  const n = construirePlats_(f);

  SpreadsheetApp.getUi().alert(
    `Fiche mise en forme.\n\n`
    + (retirees.length ? `Lignes retirées : ${retirees.reverse().join(', ')}.\n` : '')
    + `Onglet « Plats » : ${n} lignes, triables avec les flèches des en-têtes.`);
}

/** Règles de couleur de la grille des quantités, ajoutées par mettreAJour(). */
function reglesGrille_(f, der, derCol) {
  const grille = f.getRange(PREMIERE_LIGNE, COL_PRODUITS, der - PREMIERE_LIGNE + 1, derCol - COL_PRODUITS + 1);
  const coin = `F${PREMIERE_LIGNE}`;
  return [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(fx_(`=AND(ISNUMBER(${coin}),${coin}>0)`))
      .setBackground('#d9ead3').setBold(true).setRanges([grille]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(fx_(`=AND(ISNUMBER(${coin}),${coin}=0)`))
      .setFontColor('#ffffff').setRanges([grille]).build(),
  ];
}

/** Écrit l'onglet « Plats » ; rend le nombre de lignes écrites. */
function construirePlats_(f) {
  const ss = SpreadsheetApp.getActive();
  SEP = separateur_(f);
  const der = derniereLigneIngredient_(f);
  const derCol = derniereColonneProduit_(f);
  const rCout = trouverLibelle_(f, der, LIBELLE_COUT);
  const rPrix = trouverLibelle_(f, der, 'Prix de vente');
  const rObj = trouverLibelle_(f, der, 'Objectif coût');
  const rPart = trouverLibelle_(f, der, LIBELLE_PART);
  if (!rCout || !rPrix || !rObj) throw new Error('Bloc de calcul incomplet : lancez « Mettre à jour les calculs ».');

  let p = ss.getSheetByName(FEUILLE_PLATS);
  if (p && String(p.getRange(1, 1).getValue()).trim() !== ENTETES_PLATS[0]) {
    throw new Error(`Un onglet « ${FEUILLE_PLATS} » existe déjà et n'a pas été fait par ce menu (A1 ≠ « Plat »). Renommez-le, puis relancez.`);
  }
  if (!p) p = ss.insertSheet(FEUILLE_PLATS);

  // Les noms : produits de la fiche, puis boissons.
  const noms = f.getRange(LIGNE_ENTETE, COL_PRODUITS, 1, derCol - COL_PRODUITS + 1).getDisplayValues()[0]
    .map((v) => v.trim()).filter((v) => v);
  const b = ss.getSheetByName(FEUILLE_BOISSONS);
  if (b && b.getLastRow() > 1) {
    b.getRange(2, 1, b.getLastRow() - 1, 1).getDisplayValues()
      .forEach(([v]) => { if (v.trim() && !noms.includes(v.trim())) noms.push(v.trim()); });
  }

  const I = `'${FEUILLE}'!`;
  const fin = lettre_(derCol);
  const dansFiche = (r, ligne) => `INDEX(${I}$${ligne}:$${ligne},MATCH($A${r},${I}$${LIGNE_ENTETE}:$${LIGNE_ENTETE},0))`;
  const dansBoissons = (r, col) => `INDEX(Boissons!$${col}:$${col},MATCH($A${r},Boissons!$A:$A,0))`;
  const formules = noms.map((_, i) => {
    const r = i + 2;
    const qtes = `INDEX(${I}$F$${PREMIERE_LIGNE}:$${fin}$${der},0,MATCH($A${r},${I}$F$${LIGNE_ENTETE}:$${fin}$${LIGNE_ENTETE},0))`;
    return [
      `=IFERROR(INDEX('${FEUILLE_CARTE}'!$A:$A,MATCH($A${r},'${FEUILLE_CARTE}'!$C:$C,0)),"hors carte")`,
      `=IFERROR(TEXTJOIN(CHAR(10),TRUE,FILTER(${I}$B$${PREMIERE_LIGNE}:$B$${der}&" × "&${qtes},${qtes}>0)),"")`,
      `=IFERROR(${dansFiche(r, rCout)},IFERROR(${dansBoissons(r, 'B')},""))`,
      `=IFERROR(${dansFiche(r, rPrix)},IFERROR(${dansBoissons(r, 'C')},""))`,
      `=IF(OR(D${r}="",E${r}=""),"",E${r}-D${r})`,
      `=IF(OR(D${r}="",E${r}="",E${r}=0),"",D${r}/E${r})`,
      `=IF(D${r}="","",CEILING(D${r}/${I}$F$${rObj},5))`,
      rPart
        ? `=IFERROR(${dansFiche(r, rPart)},IFERROR(${dansBoissons(r, 'H')},""))`
        : `=IFERROR(${dansBoissons(r, 'H')},"")`,
      `=IF(OR(F${r}="",I${r}=""),"",F${r}*I${r})`,
    ].map(fx_);
  });

  // Réécriture complète : le filtre d'abord, puis le contenu.
  if (p.getFilter && p.getFilter()) p.getFilter().remove();
  if (p.getMaxRows() < noms.length + 1) p.insertRowsAfter(p.getMaxRows(), noms.length + 1 - p.getMaxRows());
  p.getRange(1, 1, p.getMaxRows(), ENTETES_PLATS.length).clearContent();
  p.getRange(1, 1, 1, ENTETES_PLATS.length).setValues([ENTETES_PLATS])
    .setFontWeight('bold').setBackground('#cfe2f3');
  p.getRange(2, 1, noms.length, 1).setValues(noms.map((nom) => [nom])).setFontWeight('bold');
  p.getRange(2, 2, noms.length, ENTETES_PLATS.length - 1).setFormulas(formules);

  const col = (c) => p.getRange(2, c, noms.length, 1);
  col(3).setWrap(true);
  [4, 5, 6, 10].forEach((c) => col(c).setNumberFormat('0.00'));
  col(7).setNumberFormat('0%');
  col(8).setNumberFormat('0');
  col(9).setNumberFormat('0%');
  p.setColumnWidth(1, 150);
  p.setColumnWidth(3, 220);
  p.setFrozenRows(1);
  p.setFrozenColumns(1);

  // Coût / prix : rouge au-dessus de l'objectif, vert en dessous.
  // Une règle de couleur ne peut viser un autre onglet qu'au travers d'INDIRECT.
  const obj = `INDIRECT("'${FEUILLE}'!F${rObj}")`;
  p.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(fx_(`=AND(ISNUMBER($G2),$G2>${obj})`))
      .setBackground('#f4cccc').setRanges([col(7)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(fx_(`=AND(ISNUMBER($G2),$G2<=${obj})`))
      .setBackground('#d9ead3').setRanges([col(7)]).build(),
  ]);
  p.getRange(1, 1, noms.length + 1, ENTETES_PLATS.length).createFilter();
  return noms.length;
}
