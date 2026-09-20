/**
 * Onglet « Carte appli » : ce que l'équipe vend aux clients depuis la page
 * Snack de KasbahCalendar. Une ligne par article, dans l'ordre de l'appli.
 *
 *   A Rubrique            titre du groupe dans l'appli (Boissons, Paninis…)
 *   B Article             nom affiché dans l'appli
 *   C Produit de la fiche nom exact du produit dans « Cout par item »
 *                         (ligne 2) ou de la boisson dans « Boissons »
 *                         (colonne A) : son prix de vente est repris de là
 *   D Sauce               coché = une des 4 sauces à choisir à la vente
 *   E Frites              coché = « avec ou sans frites » à choisir
 *   F Code                identifiant fixe de l'article dans l'appli
 *   G Prix envoyé         écrit par le script au dernier envoi
 *   H Retenue             ce que la maison garde sur le bénéfice avant la
 *                         prime du vendeur, en dirhams. Créée et pré-remplie
 *                         par le script : 5 DH, 1 DH sur les boissons.
 *                         Modifiable ligne par ligne, vide = 5 DH
 *
 * Le prix de revient part avec la carte : il est lu dans « Cout par item »
 * (ligne « Coût revient ») ou, pour une boisson, dans « Boissons »
 * (colonne B, prix d'achat). C'est lui qui permet à l'appli de calculer la
 * prime du vendeur = (prix de vente − coût − retenue) × quantité.
 *
 * Le code `menu_frites` n'est pas un article : c'est le prix ajouté quand
 * on choisit « avec frites ». Il est obligatoire dès qu'une case Frites
 * est cochée.
 *
 * Les prix partent avec les prix coûtants (menu « Envoyer les prix à
 * l'appli » et envoi du soir). Comme pour le Code équipe : on peut
 * renommer un article ou changer son prix, jamais changer son code.
 */

const FEUILLE_CARTE = 'Carte appli';
const ENTETES_CARTE = ['Rubrique', 'Article', 'Produit de la fiche', 'Sauce', 'Frites', 'Code', 'Prix envoyé', 'Retenue'];
const CODE_SUPPLEMENT_FRITES = 'menu_frites';
const ENTETE_RETENUE = 'Retenue';
const RETENUE_DEFAUT = 5;
const RETENUE_BOISSON = 1;

// Pré-remplissage, d'après la carte Snacks and Drinks.
const CARTE_DEPART = [
  ['Boissons', "Jus d'orange frais", "Jus d'orange", false, false, 'jus_orange'],
  ['Boissons', 'Eau 1,5 L', 'Eau 1,5 L', false, false, 'eau'],
  ['Boissons', 'Coca / Hawai', 'Coca / Hawai', false, false, 'coca'],
  ['Boissons', 'Bière', 'Bière', false, false, 'biere'],
  ['Boissons chaudes', 'Café', 'Café', false, false, 'cafe'],
  ['Boissons chaudes', 'Théière à partager', 'Théière', false, false, 'theiere'],
  ['Paninis', 'Panini nuggets & dinde', 'P.NugDinde', true, true, 'panini_nuggets_dinde'],
  ['Paninis', 'Panini kefta', 'PaniniKefta', true, true, 'panini_kefta'],
  ['Paninis', 'Panini kefta & nuggets', 'P.kefNug', true, true, 'panini_kefta_nuggets'],
  ['Paninis', 'Panini chameau', 'P.Chameau', true, true, 'panini_chameau'],
  ['Burgers', 'Burger bœuf', 'Burger', true, true, 'burger'],
  ['Burgers', 'Burger chameau', 'Burger chameau', true, true, 'burger_chameau'],
  ['Sandwich', 'Sandwich tomate, œuf & avocat', 'Sandwich', false, true, 'sandwich'],
  ['Frites', 'Frites', 'Frites', true, false, 'frites'],
  ['Frites', 'Frites & nuggets', 'Frites et nuggets', true, false, 'frites_nuggets'],
  ['Plats', 'Tajine kefta', 'Tajine kefta', false, false, 'tajine_kefta'],
  ['Plats', 'Tajine kefta de chameau', 'Tajine chameau', false, false, 'tajine_chameau'],
  ['Supplément', 'Avec frites (menu)', 'Menu (+frites)', false, false, CODE_SUPPLEMENT_FRITES],
];

/** Menu « Créer l'onglet Carte appli » : une seule fois, pré-rempli. */
function creerCarteAppli() {
  const ui = SpreadsheetApp.getUi();
  try {
    const ss = SpreadsheetApp.getActive();
    if (ss.getSheetByName(FEUILLE_CARTE)) {
      throw new Error(`l'onglet « ${FEUILLE_CARTE} » existe déjà : modifiez-le directement.`);
    }
    const prix = prixDeVente_();
    const c = ss.insertSheet(FEUILLE_CARTE);
    c.getRange(1, 1, 1, ENTETES_CARTE.length).setValues([ENTETES_CARTE])
      .setFontWeight('bold').setBackground('#efefef');
    c.setFrozenRows(1);
    const n = CARTE_DEPART.length;
    c.getRange(2, 1, n, 6).setValues(CARTE_DEPART);
    c.getRange(2, 4, n, 2).insertCheckboxes();
    c.getRange(2, 6, n, 1).setBackground('#fff2cc');
    c.getRange(2, 7, n, 1).setNumberFormat('0.00').setFontColor('#666666');
    c.getRange(2, 8, n, 1).setValues(CARTE_DEPART.map((l) => [retenuePour_(l[0])])).setNumberFormat('0.00');
    [110, 220, 150, 60, 60, 170, 90, 80].forEach((w, i) => c.setColumnWidth(i + 1, w));

    const introuvables = CARTE_DEPART
      .map((l, i) => ({ l, r: i + 2 }))
      .filter(({ l }) => !prix[cle_(l[2])]);
    introuvables.forEach(({ r }) => c.getRange(r, 3).setBackground('#fce5cd'));
    ui.alert('Carte appli',
      `${n} lignes créées. Cochez Sauce / Frites selon ce qu'on doit choisir à la vente.\n\n`
      + 'Code (jaune) : ne plus le changer une fois envoyé.'
      + (introuvables.length
        ? `\n\nProduit introuvable dans la fiche (orange) : ${introuvables.map(({ l }) => l[2]).join(', ')}. `
          + 'Écrivez le nom exact du produit (Cout par item, ligne 2) ou de la boisson (Boissons, colonne A).'
        : ''),
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert(`Impossible : ${e.message}`);
  }
}

/** Retenue proposée d'après la rubrique : 1 DH sur les boissons, 5 DH ailleurs. */
function retenuePour_(rubrique) {
  return /boisson/i.test(String(rubrique)) ? RETENUE_BOISSON : RETENUE_DEFAUT;
}

/**
 * Colonne « Retenue » de l'onglet Carte appli : retrouvée par son en-tête,
 * créée à droite et pré-remplie si elle manque (carte faite avant que la
 * prime du vendeur existe). Rien n'est écrasé si elle est déjà là.
 */
function colonneRetenue_(c) {
  const entetes = c.getRange(1, 1, 1, Math.max(c.getLastColumn(), 1)).getValues()[0];
  const i = entetes.findIndex((e) => String(e).trim() === ENTETE_RETENUE);
  if (i >= 0) return i + 1;

  const col = c.getLastColumn() + 1;
  c.getRange(1, col).setValue(ENTETE_RETENUE).setFontWeight('bold').setBackground('#efefef');
  c.setColumnWidth(col, 80);
  const n = c.getLastRow() - 1;
  if (n > 0) {
    const rubriques = c.getRange(2, 1, n, 1).getValues();
    c.getRange(2, col, n, 1)
      .setValues(rubriques.map((l) => [String(l[0]).trim() ? retenuePour_(l[0]) : '']))
      .setNumberFormat('0.00');
  }
  return col;
}

/**
 * Prix de revient connus, par nom ramené à sa clé : produits de « Cout par
 * item » (ligne « Coût revient ») puis boissons (colonne B, prix d'achat).
 * Même chemin que prixDeVente_, une ligne plus haut.
 */
function coutDeRevient_() {
  const cout = {};
  const f = feuille_();
  const der = derniereLigneIngredient_(f);
  const derCol = derniereColonneProduit_(f);
  const ligne = trouverLibelle_(f, der, LIBELLE_COUT);
  if (ligne) {
    const noms = f.getRange(LIGNE_ENTETE, COL_PRODUITS, 1, derCol - COL_PRODUITS + 1).getDisplayValues()[0];
    const valeurs = f.getRange(ligne, COL_PRODUITS, 1, derCol - COL_PRODUITS + 1).getValues()[0];
    noms.forEach((nom, j) => { if (cle_(nom)) cout[cle_(nom)] = valeurs[j]; });
  }
  const b = SpreadsheetApp.getActive().getSheetByName(FEUILLE_BOISSONS);
  if (b && b.getLastRow() > 1) {
    b.getRange(2, 1, b.getLastRow() - 1, 2).getValues().forEach((l) => {
      const k = cle_(l[0]);
      if (k && cout[k] === undefined) cout[k] = l[1];
    });
  }
  return cout;
}

/**
 * Prix de vente connus, par nom ramené à sa clé : produits de « Cout par
 * item » (ligne « Prix de vente ») puis boissons (colonne C).
 */
function prixDeVente_() {
  const prix = {};
  const f = feuille_();
  const der = derniereLigneIngredient_(f);
  const derCol = derniereColonneProduit_(f);
  const ligne = trouverLibelle_(f, der, 'Prix de vente');
  if (ligne) {
    const noms = f.getRange(LIGNE_ENTETE, COL_PRODUITS, 1, derCol - COL_PRODUITS + 1).getDisplayValues()[0];
    const valeurs = f.getRange(ligne, COL_PRODUITS, 1, derCol - COL_PRODUITS + 1).getValues()[0];
    noms.forEach((nom, j) => { if (cle_(nom)) prix[cle_(nom)] = valeurs[j]; });
  }
  const b = SpreadsheetApp.getActive().getSheetByName(FEUILLE_BOISSONS);
  if (b && b.getLastRow() > 1) {
    b.getRange(2, 1, b.getLastRow() - 1, 3).getValues().forEach((l) => {
      const k = cle_(l[0]);
      if (k && prix[k] === undefined) prix[k] = l[2];
    });
  }
  return prix;
}

/**
 * Carte à envoyer, lue et vérifiée ; null si l'onglet n'existe pas encore
 * (l'appli garde alors sa carte). Lève à la première ligne fausse : rien
 * n'est envoyé tant que la carte n'est pas juste.
 */
function lireCarte_() {
  const c = SpreadsheetApp.getActive().getSheetByName(FEUILLE_CARTE);
  if (!c || c.getLastRow() < 2) return null;
  const prix = prixDeVente_();
  const cout = coutDeRevient_();
  const colRetenue = colonneRetenue_(c);
  const lignes = c.getRange(2, 1, c.getLastRow() - 1, 6).getValues();
  const retenues = c.getRange(2, colRetenue, c.getLastRow() - 1, 1).getValues();
  const carte = [];
  const vus = {};
  lignes.forEach((l, i) => {
    const [rubrique, article, produit, sauce, frites, codeBrut] = l;
    const r = i + 2;
    if (!String(article).trim() && !String(codeBrut).trim()) return; // ligne vide
    const ou = `${FEUILLE_CARTE}, ligne ${r}`;
    const code = String(codeBrut).trim();
    if (!/^[a-z][a-z0-9_]{1,29}$/.test(code)) {
      throw new Error(`${ou} : code « ${code} » : minuscules, chiffres ou _ seulement (2 à 30).`);
    }
    if (vus[code]) throw new Error(`${ou} : code « ${code} » utilisé deux fois.`);
    vus[code] = true;
    if (!String(article).trim()) throw new Error(`${ou} : colonne Article vide.`);
    if (!String(rubrique).trim()) throw new Error(`${ou} : colonne Rubrique vide.`);
    const p = prix[cle_(produit)];
    if (p === undefined) {
      throw new Error(`${ou} : produit « ${produit} » introuvable (Cout par item, ligne 2, ou Boissons, colonne A).`);
    }
    if (typeof p !== 'number' || p <= 0) throw new Error(`${ou} : « ${produit} » n'a pas de prix de vente.`);
    // Coût de revient : sans lui l'appli ne donne pas de prime, mais la
    // vente doit rester possible. On n'arrête donc pas l'envoi.
    const revient = cout[cle_(produit)];
    const retenue = retenues[i][0];
    if (retenue !== '' && retenue !== null && (typeof retenue !== 'number' || retenue < 0)) {
      throw new Error(`${ou} : retenue « ${retenue} » : un nombre de dirhams, 0 ou plus (vide = ${RETENUE_DEFAUT} DH).`);
    }
    carte.push({
      code: code,
      rubrique: String(rubrique).trim(),
      libelle: String(article).trim(),
      prix_vente: p,
      sauce: sauce === true || /^oui$/i.test(String(sauce).trim()),
      frites: frites === true || /^oui$/i.test(String(frites).trim()),
      cout: typeof revient === 'number' && revient > 0 ? revient : null,
      retenue: typeof retenue === 'number' ? retenue : RETENUE_DEFAUT,
      position: carte.length,
      ligne: r,
    });
  });
  if (carte.length === 0) return null;
  if (carte.some((a) => a.frites) && !vus[CODE_SUPPLEMENT_FRITES]) {
    throw new Error(`${FEUILLE_CARTE} : une case Frites est cochée, il faut une ligne de code « ${CODE_SUPPLEMENT_FRITES} » (prix du supplément frites).`);
  }
  return carte;
}

/** Après un envoi réussi : prix envoyés en colonne G. */
function noterPrixEnvoyes_(carte) {
  const c = SpreadsheetApp.getActive().getSheetByName(FEUILLE_CARTE);
  if (!c || !carte) return;
  c.getRange(2, 7, c.getLastRow() - 1, 1).clearContent();
  carte.forEach((a) => c.getRange(a.ligne, 7).setValue(a.prix_vente));
}
