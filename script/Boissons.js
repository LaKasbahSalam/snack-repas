/**
 * Onglet « Boissons » : une boisson par ligne, prix d'achat et prix de vente
 * saisis à la main, marge et coût / prix calculés. Pas de recette : une
 * boisson n'entre dans la composition d'aucun sandwich.
 *
 * Menu « Déplacer les boissons dans leur onglet » (une fois) : crée l'onglet,
 * y recopie les boissons de « Cout par item » avec leur prix de vente, puis
 * retire de « Cout par item » leurs colonnes et les ingrédients qui ne
 * servaient qu'à elles.
 */

const FEUILLE_BOISSONS = 'Boissons';
const ENTETES_BOISSONS = ['Boisson', "Prix d'achat", 'Prix de vente', 'Marge (DH)', 'Coût / prix'];
const BOISSONS = ["Jus d'orange", 'Eau 1,5 L', 'Coca / Hawai', 'Bière', 'Café', 'Théière'];
// Ingrédients retirés s'ils ne servent plus à aucun produit restant.
// « pain sandwich » : doublon de « Pain », créé par erreur.
const INGREDIENTS_BOISSONS = ['oranges', 'eau 1,5 L', 'Coca / Hawai', 'bière', 'café', 'thé', 'sucre', 'menthe', 'pain sandwich'];

function deplacerBoissons() {
  const ui = SpreadsheetApp.getUi();
  try {
    const ss = SpreadsheetApp.getActive();
    const f = feuille_();
    const der = derniereLigneIngredient_(f);
    const derCol = derniereColonneProduit_(f);
    const nbProd = derCol - COL_PRODUITS + 1;
    const nbIng = der - PREMIERE_LIGNE + 1;

    // Tout repérer avant d'écrire quoi que ce soit.
    const entetes = f.getRange(LIGNE_ENTETE, COL_PRODUITS, 1, nbProd).getDisplayValues()[0];
    const clesBoissons = BOISSONS.map(cle_);
    const colsBoissons = [];
    entetes.forEach((e, j) => { if (clesBoissons.includes(cle_(e))) colsBoissons.push(COL_PRODUITS + j); });

    const ligneVente = trouverLibelle_(f, der, 'Prix de vente');
    const prixVente = {};
    colsBoissons.forEach((c) => {
      const v = ligneVente ? f.getRange(ligneVente, c).getValue() : '';
      prixVente[cle_(entetes[c - COL_PRODUITS])] = typeof v === 'number' ? v : '';
    });

    const noms = f.getRange(PREMIERE_LIGNE, 2, nbIng, 1).getValues();
    const achat = f.getRange(PREMIERE_LIGNE, 3, nbIng, 2).getValues();
    const qtes = f.getRange(PREMIERE_LIGNE, COL_PRODUITS, nbIng, nbProd).getValues();
    const colCode = f.getRange(LIGNE_ENTETE, 1, 1, f.getLastColumn()).getValues()[0]
      .findIndex((e) => String(e).trim() === ENTETE_CODE) + 1;
    const codes = colCode ? f.getRange(PREMIERE_LIGNE, colCode, nbIng, 1).getValues() : [];
    const clesIng = INGREDIENTS_BOISSONS.map(cle_);
    const lignesRetirees = [];
    const gardes = [];
    noms.forEach((l, i) => {
      if (!clesIng.includes(cle_(l[0]))) return;
      const sertAilleurs = qtes[i].some((q, j) => !colsBoissons.includes(COL_PRODUITS + j) && q !== '' && q !== 0);
      const aDesDonnees = achat[i].some((v) => v !== '') || (colCode && String(codes[i][0]).trim());
      if (sertAilleurs || aDesDonnees) gardes.push(String(l[0]));
      else lignesRetirees.push(PREMIERE_LIGNE + i);
    });

    let b = ss.getSheetByName(FEUILLE_BOISSONS);
    const dejaLa = {};
    if (b) b.getRange(2, 1, Math.max(b.getLastRow() - 1, 1), 1).getValues()
      .forEach((l) => { if (cle_(l[0])) dejaLa[cle_(l[0])] = true; });
    const aAjouter = BOISSONS.filter((n) => !dejaLa[cle_(n)]);

    if (!colsBoissons.length && !lignesRetirees.length && !aAjouter.length) {
      ui.alert('Les boissons sont déjà dans leur onglet.');
      return;
    }
    const ok = ui.alert('Déplacer les boissons',
      `Onglet « ${FEUILLE_BOISSONS} » : ${aAjouter.join(', ') || 'rien à ajouter'}.\n\n`
      + `Retirés de « ${FEUILLE} » : ${colsBoissons.length} colonne(s) de boissons, `
      + `${lignesRetirees.length} ingrédient(s) : ${lignesRetirees.map((r) => noms[r - PREMIERE_LIGNE][0]).join(', ') || '—'}.`
      + (gardes.length ? `\n\nGardés (utilisés ailleurs ou déjà remplis) : ${gardes.join(', ')}.` : '')
      + '\n\nContinuer ?', ui.ButtonSet.OK_CANCEL);
    if (ok !== ui.Button.OK) return;

    // 1. Onglet Boissons.
    if (!b) {
      b = ss.insertSheet(FEUILLE_BOISSONS, f.getIndex());
      b.getRange(1, 1, 1, ENTETES_BOISSONS.length).setValues([ENTETES_BOISSONS]).setFontWeight('bold');
      b.setFrozenRows(1);
      b.setColumnWidth(1, 160);
    }
    aAjouter.forEach((nom) => {
      const r = Math.max(b.getLastRow(), 1) + 1;
      b.getRange(r, 1, 1, 3).setValues([[nom, '', prixVente[cle_(nom)] ?? '']]);
    });
    formaterBoissons_(b);

    // 2. Cout par item : colonnes puis lignes, de la fin vers le début.
    colsBoissons.sort((x, y) => y - x).forEach((c) => f.deleteColumn(c));
    lignesRetirees.sort((x, y) => y - x).forEach((r) => f.deleteRow(r));
    mettreAJour();

    ui.alert(`Boissons déplacées. Saisissez les prix d'achat (cases jaunes) dans l'onglet « ${FEUILLE_BOISSONS} ».`);
  } catch (e) {
    ui.alert(`Impossible : ${e.message}`);
  }
}

/** Formules et couleurs de toutes les lignes de l'onglet Boissons. */
function formaterBoissons_(b) {
  const n = b.getLastRow() - 1;
  if (n < 1) return;
  SEP = separateur_(b);
  const formules = [];
  for (let r = 2; r <= n + 1; r++) {
    formules.push([
      fx_(`=IF(OR(B${r}="",C${r}=""),"",C${r}-B${r})`),
      fx_(`=IF(OR(B${r}="",C${r}="",C${r}=0),"",B${r}/C${r})`),
    ]);
  }
  b.getRange(2, 4, n, 2).setFormulas(formules);
  b.getRange(2, 2, n, 2).setNumberFormat('0.00').setBackground(JAUNE);
  b.getRange(2, 4, n, 1).setNumberFormat('0.00');
  b.getRange(2, 5, n, 1).setNumberFormat('0%');
}

/** Ligne du bloc de calcul portant ce libellé en colonne E, ou 0. */
function trouverLibelle_(f, der, libelle) {
  const e = f.getRange(der + 1, COL_LIBELLES, f.getMaxRows() - der, 1).getValues();
  const i = e.findIndex((l) => String(l[0]).trim() === libelle);
  return i < 0 ? 0 : der + 1 + i;
}
