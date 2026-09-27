/**
 * Part du vendeur, en % du bénéfice, réglée article par article dans le
 * classeur. Décision Karim du 27/09/2026 : le classeur seul fait foi, la
 * base de l'appli ne calcule plus de prime.
 *
 *   « Items & Sandwichs » : ligne « Part vendeur » (libellé en colonne E,
 *                           sous le bloc de calcul), une case par produit.
 *   « Boissons »          : colonne « Part vendeur ».
 *   « Carte appli »       : colonnes « Coût revient » et « Part vendeur »,
 *                           de simples renvois vers la case du produit
 *                           (='Items & Sandwichs'!H12, =Boissons!F5),
 *                           réécrits à chaque envoi. Le Journal Snack ne
 *                           lit que ces deux colonnes.
 *
 * Au premier passage, la ligne et la colonne sont créées à 80 % (le
 * partage d'avant), 0 % pour la bière. Ensuite le script ne touche plus
 * jamais à ces valeurs : c'est vous qui les réglez.
 *
 * Les renvois n'ont ni « , » ni « ; » : ils marchent quelle que soit la
 * langue du classeur.
 */

const LIBELLE_PART = 'Part vendeur';
const ENTETE_COUT_CARTE = 'Coût revient';
const PART_DEPART = 0.8;

/** Crée ce qui manque et relie « Carte appli » aux fiches. Appelée à chaque envoi. */
function preparerPartsVendeur_() {
  const ss = SpreadsheetApp.getActive();
  const c = ss.getSheetByName(FEUILLE_CARTE);
  if (!c || c.getLastRow() < 2) return; // pas de carte : rien à relier

  // 1. « Items & Sandwichs » : la ligne « Part vendeur », sous tout le reste.
  const f = feuille_();
  const der = derniereLigneIngredient_(f);
  const nb = derniereColonneProduit_(f) - COL_PRODUITS + 1;
  let lPart = trouverLibelle_(f, der, LIBELLE_PART);
  if (!lPart) {
    lPart = f.getLastRow() + 2;
    if (lPart > f.getMaxRows()) f.insertRowsAfter(f.getMaxRows(), lPart - f.getMaxRows());
    f.getRange(lPart, COL_LIBELLES).setValue(LIBELLE_PART).setFontWeight('bold');
    f.getRange(lPart, COL_PRODUITS, 1, nb).setValues([Array(nb).fill(PART_DEPART)]).setNumberFormat('0%');
  }
  const lCout = trouverLibelle_(f, der, LIBELLE_COUT);
  const produits = {};
  f.getRange(LIGNE_ENTETE, COL_PRODUITS, 1, nb).getDisplayValues()[0].forEach((nom, j) => {
    if (cle_(nom) && !produits[cle_(nom)]) produits[cle_(nom)] = lettre_(COL_PRODUITS + j);
  });

  // 2. « Boissons » : la colonne « Part vendeur ».
  const b = ss.getSheetByName(FEUILLE_BOISSONS);
  const boissons = {};
  let lettrePartB = '';
  if (b && b.getLastRow() > 1) {
    const avait = b.getRange(1, 1, 1, b.getLastColumn()).getValues()[0]
      .some((e) => String(e).trim() === LIBELLE_PART);
    const colPartB = colonneBoissons_(b, LIBELLE_PART);
    lettrePartB = lettre_(colPartB);
    const noms = b.getRange(2, 1, b.getLastRow() - 1, 1).getValues();
    if (!avait) {
      b.getRange(2, colPartB, noms.length, 1).setValues(noms.map(([nom]) => [
        !cle_(nom) ? '' : cle_(nom).startsWith('biere') ? 0 : PART_DEPART,
      ])).setNumberFormat('0%');
    }
    noms.forEach(([nom], i) => {
      if (cle_(nom) && !boissons[cle_(nom)]) boissons[cle_(nom)] = i + 2;
    });
  }

  // 3. « Carte appli » : chaque article renvoie à son coût et à sa part,
  //    produits d'abord, boissons ensuite (même ordre que l'envoi des prix).
  const colCout = colonneBoissons_(c, ENTETE_COUT_CARTE);
  const colPart = colonneBoissons_(c, LIBELLE_PART);
  const n = c.getLastRow() - 1;
  const cout = [];
  const part = [];
  c.getRange(2, 3, n, 1).getValues().forEach(([produit]) => {
    const k = cle_(produit);
    if (k && produits[k] && lCout) {
      cout.push([`='${FEUILLE}'!${produits[k]}${lCout}`]);
      part.push([`='${FEUILLE}'!${produits[k]}${lPart}`]);
    } else if (k && boissons[k]) {
      cout.push([`='${FEUILLE_BOISSONS}'!B${boissons[k]}`]);
      part.push([`='${FEUILLE_BOISSONS}'!${lettrePartB}${boissons[k]}`]);
    } else {
      cout.push(['']);
      part.push(['']);
    }
  });
  c.getRange(2, colCout, n, 1).setFormulas(cout).setNumberFormat('0.00');
  c.getRange(2, colPart, n, 1).setFormulas(part).setNumberFormat('0%');
}
