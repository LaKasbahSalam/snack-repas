/**
 * Part du vendeur, en % du bénéfice, réglée article par article dans le
 * classeur. Décision Karim du 27/09/2026 : le classeur seul fait foi, la
 * base de l'appli ne calcule plus de prime.
 *
 *   « Items & Sandwichs » : ligne « Part vendeur » (libellé en colonne E,
 *                           sous le bloc de calcul), une case par produit.
 *   « Boissons »          : colonne « Part vendeur ».
 *   « Carte appli »       : colonnes « Coût revient » et « Part vendeur »,
 *                           des RECHERCHES par le nom de la colonne C
 *                           (« Produit de la fiche ») dans « Items &
 *                           Sandwichs » puis « Boissons ». La même formule
 *                           sur toutes les lignes : pour un nouvel article,
 *                           tirer la formule de la ligne du dessus suffit.
 *
 * Le nom en colonne C doit être écrit exactement comme l'en-tête du
 * produit (ligne 2 de « Items & Sandwichs ») ou le nom de la boisson
 * (colonne A de « Boissons ») ; les majuscules ne comptent pas. Un nom qui
 * ne correspond qu'à un accent ou une ponctuation près est remplacé par le
 * nom exact à chaque envoi. Un nom introuvable laisse les deux cases
 * vides : le Journal compte alors un bénéfice nul, rien pour le vendeur.
 *
 * Au premier passage, la ligne et la colonne « Part vendeur » sont créées
 * à 80 % (le partage d'avant), 0 % pour la bière. Ensuite le script ne
 * touche plus jamais à ces valeurs : c'est vous qui les réglez.
 *
 * Les formules sont écrites avec le séparateur de la langue du classeur
 * (« ; » en français), détecté par separateur_().
 */

const LIBELLE_PART = 'Part vendeur';
const ENTETE_COUT_CARTE = 'Coût revient';
const PART_DEPART = 0.8;

/** Crée ce qui manque et pose les recherches de « Carte appli ». Appelée à chaque envoi. */
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
  const noms = {}; // clé du nom -> nom exact, produits d'abord
  f.getRange(LIGNE_ENTETE, COL_PRODUITS, 1, nb).getDisplayValues()[0].forEach((nom) => {
    if (cle_(nom) && !noms[cle_(nom)]) noms[cle_(nom)] = nom;
  });

  // 2. « Boissons » : la colonne « Part vendeur ».
  const b = ss.getSheetByName(FEUILLE_BOISSONS);
  let lettrePartB = '';
  if (b && b.getLastRow() > 1) {
    const avait = b.getRange(1, 1, 1, b.getLastColumn()).getValues()[0]
      .some((e) => String(e).trim() === LIBELLE_PART);
    const colPartB = colonneBoissons_(b, LIBELLE_PART);
    lettrePartB = lettre_(colPartB);
    const boissons = b.getRange(2, 1, b.getLastRow() - 1, 1).getValues();
    if (!avait) {
      b.getRange(2, colPartB, boissons.length, 1).setValues(boissons.map(([nom]) => [
        !cle_(nom) ? '' : cle_(nom).startsWith('biere') ? 0 : PART_DEPART,
      ])).setNumberFormat('0%');
    }
    boissons.forEach(([nom]) => { if (cle_(nom) && !noms[cle_(nom)]) noms[cle_(nom)] = nom; });
  }

  // 3. « Carte appli » : noms remis exacts, puis la même recherche partout.
  const n = c.getLastRow() - 1;
  const produits = c.getRange(2, 3, n, 1).getValues();
  produits.forEach(([p], i) => {
    const exact = noms[cle_(p)];
    if (exact !== undefined && String(p).trim().toLowerCase() !== String(exact).trim().toLowerCase()) {
      c.getRange(i + 2, 3).setValue(exact);
    }
  });

  SEP = separateur_(c);
  const I = `'${FEUILLE}'!`;
  const B = `'${FEUILLE_BOISSONS}'!`;
  const colCout = colonneBoissons_(c, ENTETE_COUT_CARTE);
  const colPart = colonneBoissons_(c, LIBELLE_PART);
  const formules = Array.from({ length: n }, (_, i) => {
    const r = i + 2;
    const dansFiche = (ligne) => `INDEX(${I}$${ligne}:$${ligne},MATCH(C${r},${I}$${LIGNE_ENTETE}:$${LIGNE_ENTETE},0))`;
    const coutBoisson = b ? `VLOOKUP(C${r},${B}$A:$B,2,FALSE)` : '""';
    const partBoisson = b && lettrePartB ? `INDEX(${B}$${lettrePartB}:$${lettrePartB},MATCH(C${r},${B}$A:$A,0))` : '""';
    return [
      fx_(lCout ? `=IFERROR(${dansFiche(lCout)},IFERROR(${coutBoisson},""))` : `=IFERROR(${coutBoisson},"")`),
      fx_(`=IFERROR(${dansFiche(lPart)},IFERROR(${partBoisson},""))`),
    ];
  });
  c.getRange(2, colCout, n, 1).setFormulas(formules.map((l) => [l[0]])).setNumberFormat('0.00');
  c.getRange(2, colPart, n, 1).setFormulas(formules.map((l) => [l[1]])).setNumberFormat('0%');
}
