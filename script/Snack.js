/**
 * Fiche repas — onglet « Cout par item » : coût de revient, marge et prix
 * conseillé de chaque produit du snack.
 *
 * Disposition attendue :
 *   ligne 1          : photos des produits (poserImages)
 *   ligne 2          : en-têtes ; les produits commencent en colonne F
 *   lignes 3 à N     : un ingrédient par ligne (B nom, C quantité achetée,
 *                      D prix payé, E prix/unité calculé, F… quantité par produit)
 *   puis le bloc de calcul : ses lignes sont retrouvées par leur libellé en E
 *   et réécrites sur place ; les lignes ajoutées à la main entre elles ne
 *   sont jamais touchées (prix de vente et objectif mémorisés dans le fichier)
 *
 * Tout est recalculé par mettreAJour() : les plages suivent le nombre
 * d'ingrédients et de produits. Seuls les prix de vente et l'objectif sont
 * saisis à la main ; le script ne les écrase jamais.
 */

const FEUILLE = 'Cout par item';
const COL_PRODUITS = 6; // F
const COL_LIBELLES = 5; // E
const LIGNE_IMAGES = 1;
const LIGNE_ENTETE = 2;
const PREMIERE_LIGNE = 3; // premier ingrédient
const LIBELLE_COUT = 'Coût revient';
const OBJECTIF_DEFAUT = 0.35;

// Place des lignes du bloc au premier passage, comptée depuis « Produit ».
// Ensuite chaque ligne est retrouvée par son libellé en colonne E.
const L_PRODUIT = 0;
const L_COUT = 1;
const L_PRIX = 2;
const L_MARGE = 3;
const L_TAUX = 4;
const L_CONSEILLE = 5;
const L_OBJECTIF = 7;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Snack')
    .addItem('Mettre à jour les calculs', 'mettreAJour')
    .addSeparator()
    .addItem('Ajouter un ingrédient', 'ajouterIngredient')
    .addItem('Ajouter un produit', 'ajouterProduit')
    .addItem('Compléter depuis la carte', 'completerDepuisCarte')
    .addItem('Déplacer les boissons dans leur onglet', 'deplacerBoissons')
    .addSeparator()
    .addItem('Poser les photos des produits', 'poserImages')
    .addSeparator()
    .addItem("Ajouter à la page Snack de l'équipe", 'ajouterALaPageSnack')
    .addItem("Créer l'onglet Carte appli", 'creerCarteAppli')
    .addItem("Envoyer les prix à l'appli", 'envoyerPrixAppli')
    .addItem("Configurer l'envoi à l'appli", 'configurerEnvoi')
    .addItem("Programmer l'envoi chaque soir", 'programmerEnvoiSoir')
    .addToUi();
}

// Séparateur d'arguments des formules : « ; » dans une feuille en français
// (virgule décimale), « , » sinon. Fixé au début de mettreAJour().
let SEP = ',';

/** Écrit une formule avec le séparateur de la feuille (les formules du script n'ont jamais de virgule dans un texte). */
function fx_(formule) {
  return SEP === ',' ? formule : formule.replace(/,/g, SEP);
}

// Prix de vente relevés le 18/09 avant que le bloc ne casse : servent une
// seule fois, tant qu'aucun prix n'a été mémorisé pour le produit.
const PRIX_REPRISE = {
  'Frites': 20, 'Frites et nuggets': 35, 'Burger': 50,
  'PaniniKefta': 50, 'P.kefNug': 50, 'P.NugDinde': 40,
};
const ECART = 3; // premier passage : le bloc commence 3 lignes sous le dernier ingrédient
const LIBELLES = ['Produit', LIBELLE_COUT, 'Prix de vente', 'Marge (DH)', 'Coût / prix', 'Prix conseillé', 'Objectif coût'];

function mettreAJour() {
  const f = feuille_();
  SEP = separateur_(f);
  const der = derniereLigneIngredient_(f);
  const derCol = derniereColonneProduit_(f);
  const nbProduits = derCol - COL_PRODUITS + 1;
  const noms = f.getRange(LIGNE_ENTETE, COL_PRODUITS, 1, nbProduits)
    .getDisplayValues()[0].map((n) => n.trim());

  // 1. Repérer les lignes du script par leur libellé en colonne E, où
  //    qu'elles soient sous les ingrédients : vous pouvez intercaler vos
  //    propres lignes (indicateurs, objectifs…), elles ne sont jamais touchées.
  const memo = lireMemo_();
  const hauteur = f.getMaxRows() - der;
  const zone = f.getRange(der + 1, COL_LIBELLES, hauteur, nbProduits + 1).getValues();
  const lignes = {};
  const doublons = [];
  zone.forEach((l, i) => {
    const libelle = String(l[0]).trim();
    if (!LIBELLES.includes(libelle)) return;
    if (lignes[libelle]) doublons.push(der + 1 + i);
    else lignes[libelle] = der + 1 + i;
  });
  const valeursDe = (libelle) => zone[lignes[libelle] - der - 1];

  // Prix de vente et objectif saisis : relevés et mémorisés.
  if (lignes['Prix de vente']) {
    const l = valeursDe('Prix de vente');
    noms.forEach((nom, j) => {
      if (typeof l[1 + j] === 'number' && l[1 + j] > 0) memo.prix[nom] = l[1 + j];
    });
  }
  if (lignes['Objectif coût']) {
    const v = valeursDe('Objectif coût')[1];
    if (typeof v === 'number' && v > 0 && v < 1) memo.objectif = v;
  }
  ecrireMemo_(memo);
  doublons.forEach((r) => f.getRange(r, COL_LIBELLES, 1, nbProduits + 1).clear());

  if (!lignes[LIBELLE_COUT]) {
    // Premier passage : bloc complet sous les ingrédients, sur des cases vides.
    const haut = der + ECART;
    if (f.getMaxRows() < haut + L_OBJECTIF) {
      f.insertRowsAfter(f.getMaxRows(), haut + L_OBJECTIF - f.getMaxRows());
    }
    const occupees = [];
    f.getRange(haut, COL_LIBELLES, L_OBJECTIF + 1, nbProduits + 1).getValues()
      .forEach((l, i) => l.forEach((v, j) => {
        if (v !== '') occupees.push(`${lettre_(COL_LIBELLES + j)}${haut + i}`);
      }));
    if (occupees.length) {
      throw new Error(`Le bloc de calcul (lignes ${haut} à ${haut + L_OBJECTIF}) écraserait ces cases : `
        + `${occupees.slice(0, 8).join(', ')}. Déplacez-les, puis relancez.`);
    }
    const decalage = [L_PRODUIT, L_COUT, L_PRIX, L_MARGE, L_TAUX, L_CONSEILLE, L_OBJECTIF];
    LIBELLES.forEach((libelle, i) => { lignes[libelle] = haut + decalage[i]; });
  } else {
    // Ligne effacée ou remplacée à la main : recréée sur la première ligne
    // entièrement vide sous le bloc, jamais par-dessus une case remplie.
    let bas = Math.max(...Object.values(lignes));
    LIBELLES.filter((l) => !lignes[l]).forEach((libelle) => {
      let r = bas + 1;
      while (r <= f.getMaxRows()
        && f.getRange(r, COL_LIBELLES, 1, nbProduits + 1).getValues()[0].some((v) => v !== '')) r++;
      if (r > f.getMaxRows()) f.insertRowsAfter(f.getMaxRows(), r - f.getMaxRows());
      lignes[libelle] = r;
      bas = r;
    });
  }
  const R = {
    produit: lignes['Produit'], cout: lignes[LIBELLE_COUT], prix: lignes['Prix de vente'],
    marge: lignes['Marge (DH)'], taux: lignes['Coût / prix'], conseille: lignes['Prix conseillé'],
    objectif: lignes['Objectif coût'],
  };

  // Prix unitaire : calculé quand quantité achetée et prix sont remplis ;
  // sinon on garde un prix tapé à la main en E (0 et orange s'il n'y en a pas).
  const n = der - PREMIERE_LIGNE + 1;
  const cd = f.getRange(PREMIERE_LIGNE, 3, n, 2).getValues();
  const e = f.getRange(PREMIERE_LIGNE, COL_LIBELLES, n, 1);
  const eFormules = e.getFormulas();
  const eValeurs = e.getValues();
  for (let i = 0; i < n; i++) {
    const r = PREMIERE_LIGNE + i;
    const [qte, prix] = cd[i];
    const saisiMain = !eFormules[i][0] && typeof eValeurs[i][0] === 'number' && eValeurs[i][0] > 0;
    if ((qte > 0 && prix !== '') || !saisiMain) {
      f.getRange(r, COL_LIBELLES).setFormula(fx_(`=IF(AND(C${r}>0,D${r}<>""),D${r}/C${r},0)`));
    }
  }
  e.setNumberFormat('0.00');

  // Libellés.
  LIBELLES.forEach((libelle) => f.getRange(lignes[libelle], COL_LIBELLES).setValue(libelle).setFontWeight('bold'));
  f.getRange(R.objectif, COL_PRODUITS).setValue(memo.objectif || OBJECTIF_DEFAUT)
    .setNumberFormat('0%').setBackground('#fff2cc');

  // Prix de vente : saisie à la main ; une case vide est reprise de la mémoire.
  f.getRange(R.prix, COL_PRODUITS, 1, nbProduits).setValues([
    noms.map((nom) => memo.prix[nom] ?? PRIX_REPRISE[nom] ?? ''),
  ]);

  // Formules, une colonne par produit.
  const obj = `$F$${R.objectif}`;
  const ligneDe = (r, gabarit) => {
    const formules = [];
    for (let c = COL_PRODUITS; c <= derCol; c++) formules.push(fx_(gabarit(lettre_(c))));
    f.getRange(r, COL_PRODUITS, 1, nbProduits).setFormulas([formules]);
  };
  ligneDe(R.produit, (L) => `=${L}${LIGNE_ENTETE}`);
  ligneDe(R.cout, (L) => `=SUMPRODUCT($E$${PREMIERE_LIGNE}:$E$${der},${L}${PREMIERE_LIGNE}:${L}${der})`);
  ligneDe(R.marge, (L) => `=IF(${L}${R.prix}="","",${L}${R.prix}-${L}${R.cout})`);
  ligneDe(R.taux, (L) => `=IF(${L}${R.prix}="","",${L}${R.cout}/${L}${R.prix})`);
  ligneDe(R.conseille, (L) => `=CEILING(${L}${R.cout}/${obj},5)`);

  // Formats.
  const ligne = (r) => f.getRange(r, COL_PRODUITS, 1, nbProduits);
  ligne(R.produit).setFontWeight('bold').setWrap(true);
  ligne(R.cout).setNumberFormat('0.00');
  ligne(R.prix).setNumberFormat('0').setBackground('#fff2cc');
  ligne(R.marge).setNumberFormat('0.00');
  ligne(R.taux).setNumberFormat('0%');
  ligne(R.conseille).setNumberFormat('0');

  // Couleurs (remplacent les règles de mise en forme de cet onglet).
  const premier = `F${R.taux}`;
  f.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(fx_(`=AND(${premier}<>"",${premier}>${obj})`))
      .setBackground('#f4cccc').setRanges([ligne(R.taux)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(fx_(`=AND(${premier}<>"",${premier}<=${obj})`))
      .setBackground('#d9ead3').setRanges([ligne(R.taux)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(fx_(`=OR($E${PREMIERE_LIGNE}="",$E${PREMIERE_LIGNE}=0)`))
      .setBackground('#fce5cd').setRanges([e]).build(),
  ]);
}

/** Prix de vente et objectif mémorisés dans le fichier (survivent à une ligne cassée). */
function lireMemo_() {
  const brut = PropertiesService.getDocumentProperties().getProperty('saisies');
  const memo = brut ? JSON.parse(brut) : {};
  return { prix: memo.prix || {}, objectif: memo.objectif || null };
}

function ecrireMemo_(memo) {
  PropertiesService.getDocumentProperties().setProperty('saisies', JSON.stringify(memo));
}

function ajouterIngredient() {
  const f = feuille_();
  const der = derniereLigneIngredient_(f);
  const derCol = derniereColonneProduit_(f);
  f.insertRowAfter(der);
  const r = der + 1;
  f.getRange(r, 2).setValue('Nouvel ingrédient');
  f.getRange(r, COL_PRODUITS, 1, derCol - COL_PRODUITS + 1)
    .setValues([new Array(derCol - COL_PRODUITS + 1).fill(0)]);
  mettreAJour();
  f.getRange(r, 2).activate();
}

function ajouterProduit() {
  const f = feuille_();
  const der = derniereLigneIngredient_(f);
  const derCol = derniereColonneProduit_(f);
  f.insertColumnAfter(derCol);
  const c = derCol + 1;
  f.getRange(LIGNE_ENTETE, c).setValue('Nouveau produit');
  f.getRange(PREMIERE_LIGNE, c, der - PREMIERE_LIGNE + 1, 1)
    .setValues(new Array(der - PREMIERE_LIGNE + 1).fill([0]));
  mettreAJour();
  f.getRange(LIGNE_ENTETE, c).activate();
}

function feuille_() {
  const f = SpreadsheetApp.getActive().getSheetByName(FEUILLE);
  if (!f) throw new Error(`Onglet « ${FEUILLE} » introuvable.`);
  return f;
}

/** Dernière ligne d'ingrédient : les noms en B sont contigus depuis PREMIERE_LIGNE. */
function derniereLigneIngredient_(f) {
  const noms = f.getRange(PREMIERE_LIGNE, 2, f.getMaxRows() - PREMIERE_LIGNE + 1, 1).getValues();
  let n = 0;
  while (n < noms.length && String(noms[n][0]).trim() !== '') n++;
  if (n === 0) throw new Error(`Aucun ingrédient trouvé en colonne B à partir de la ligne ${PREMIERE_LIGNE}.`);
  return PREMIERE_LIGNE + n - 1;
}

/** Dernière colonne de produit : les en-têtes de la ligne LIGNE_ENTETE sont contigus depuis F. */
function derniereColonneProduit_(f) {
  const entetes = f.getRange(LIGNE_ENTETE, COL_PRODUITS, 1, f.getMaxColumns() - COL_PRODUITS + 1).getValues()[0];
  let n = 0;
  while (n < entetes.length && String(entetes[n]).trim() !== '') n++;
  if (n === 0) throw new Error(`Aucun produit trouvé en ligne ${LIGNE_ENTETE} à partir de la colonne F.`);
  return COL_PRODUITS + n - 1;
}

function lettre_(col) {
  let s = '';
  while (col > 0) {
    const m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

/**
 * Séparateur accepté par la feuille : on écrit =SUM(1,2) dans une case vide
 * tout en bas à droite de l'onglet ; si la feuille rend 3, c'est la virgule.
 */
function separateur_(f) {
  const essai = f.getRange(f.getMaxRows(), f.getMaxColumns());
  if (!essai.isBlank()) return ';';
  essai.setFormula('=SUM(1,2)');
  SpreadsheetApp.flush();
  const virgule = essai.getValue() === 3;
  essai.clearContent();
  return virgule ? ',' : ';';
}

// Photo posée en ligne 1 au-dessus de chaque produit (pas de photo nuggets :
// « Frites et nuggets » reprend celle des frites).
const PHOTOS = { F: 'frites', G: 'frites', H: 'burger', I: 'panini', J: 'panini' };

function poserImages() {
  const f = feuille_();
  if (f.getRange(1, 2).getValue() === 'Description') {
    f.insertRowBefore(1); // ancienne disposition : on libère la ligne 1
  } else if (f.getRange(LIGNE_ENTETE, 2).getValue() !== 'Description') {
    throw new Error('Disposition inattendue : « Description » doit être en B1 ou en B2.');
  }
  for (const [col, nom] of Object.entries(PHOTOS)) {
    const image = SpreadsheetApp.newCellImage()
      .setSourceUrl('data:image/jpeg;base64,' + IMAGES[nom])
      .setAltTextTitle(nom)
      .build();
    f.getRange(`${col}${LIGNE_IMAGES}`).setValue(image);
  }
  // Images en 200 × 150 : ligne de 100 px, colonnes d'au moins 133 px.
  f.setRowHeight(LIGNE_IMAGES, 100);
  for (const col of Object.keys(PHOTOS)) {
    const c = f.getRange(`${col}1`).getColumn();
    if (f.getColumnWidth(c) < 133) f.setColumnWidth(c, 133);
  }
  mettreAJour();
}
