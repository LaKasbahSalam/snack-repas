/**
 * Menu « Aligner les prix sur l'affiche » : recopie dans la fiche les prix
 * de l'affiche imprimée, pour que l'appli vende au prix que voient les
 * clients.
 *
 * Les prix de l'affiche sont écrits ci-dessous (PRIX_AFFICHE) : l'affiche
 * vit dans Claude Design, que le classeur ne sait pas lire. Ils ont été
 * relevés sur « Snacks and Drinks v7 » le 26/11/2026. Nouvelle affiche =
 * mettre ce tableau à jour, puis relancer le menu.
 *
 * Ce qui est écrit :
 *   - « Items & Sandwichs », ligne « Prix de vente », sous chaque produit ;
 *   - « Boissons », colonne C (Prix de vente).
 * Rien d'autre : ni recette, ni coût, ni « Carte appli ». Un produit de la
 * fiche absent de l'affiche (burger, bière…) garde son prix ; un article de
 * l'affiche absent de la fiche est seulement signalé : il faut d'abord
 * créer le produit (« Ajouter un produit »).
 *
 * Rien n'est écrit avant que la liste des changements ait été montrée et
 * acceptée. Ensuite, le menu propose d'envoyer tout de suite à l'appli.
 */

// [nom dans la fiche (ligne 2 d'« Items & Sandwichs » ou colonne A de
// « Boissons »), prix de l'affiche en DH]. Noms comparés sans accents,
// majuscules ni espaces en trop.
const PRIX_AFFICHE = [
  // Club sandwich
  ['Sandwich', 35],                 // Avocado, egg & tomato
  ['Omelette zaalouk', 30],         // coût au forfait (ingrédient « Omelette zaalouk (forfait) »)
  // Paninis : une seule taille, 35 ; +10 avec frites
  ['PaniniKefta', 35],
  ['P.NugDinde', 35],
  ['P.kefNug', 35],
  ['P.Chameau', 35],
  ['Menu (+frites)', 10],
  // Tajines
  ['Tajine kefta', 40],
  ['Tajine chameau', 45],
  // Accompagnements
  ['Frites', 20],
  ['Frites et nuggets', 30],
  // Boissons
  ["Jus d'orange", 15],
  ['Théière', 10],
  ['Café', 10],
  ['Coca', 10],
  ['Hawai', 10],
  ['Eau 1,5 L', 10],
];

// Sur l'affiche, mais sans produit dans la fiche : seulement signalés.
const AFFICHE_SANS_PRODUIT = [];

// Sous cette marge (prix de vente - coût de revient, en DH), le changement
// est signalé : la prime du vendeur et la part de l'hôtel deviennent minces.
const MARGE_MINIMALE = 5;

/**
 * Ce que le menu changerait, sans rien écrire.
 * Rend { changements, inchanges, horsAffiche, introuvables } ; chaque
 * changement : { ou, nom, avant, apres, cout, ecrire() }.
 */
function ecartsAffiche_() {
  const voulu = {};
  PRIX_AFFICHE.forEach(([nom, prix]) => { voulu[cle_(nom)] = { nom: nom, prix: prix, vu: false }; });
  const changements = [];
  const inchanges = [];
  const horsAffiche = [];

  const comparer = (nom, avant, cout, ou, plage) => {
    const k = cle_(nom);
    if (!k) return;
    const v = voulu[k];
    if (!v) { horsAffiche.push(String(nom).trim()); return; }
    v.vu = true;
    if (avant === v.prix) { inchanges.push(String(nom).trim()); return; }
    changements.push({
      ou: ou, nom: String(nom).trim(), avant: avant, apres: v.prix,
      cout: typeof cout === 'number' ? cout : null,
      ecrire: () => plage.setValue(v.prix),
    });
  };

  // « Items & Sandwichs » : produits en ligne 2 depuis F, prix sur la ligne « Prix de vente ».
  const f = feuille_();
  const der = derniereLigneIngredient_(f);
  const derCol = derniereColonneProduit_(f);
  const ligne = trouverLibelle_(f, der, 'Prix de vente');
  if (!ligne) throw new Error(`ligne « Prix de vente » introuvable sous les ingrédients de « ${FEUILLE} » (colonne E).`);
  const ligneCout = trouverLibelle_(f, der, LIBELLE_COUT);
  const nb = derCol - COL_PRODUITS + 1;
  const noms = f.getRange(LIGNE_ENTETE, COL_PRODUITS, 1, nb).getDisplayValues()[0];
  const prix = f.getRange(ligne, COL_PRODUITS, 1, nb).getValues()[0];
  const couts = ligneCout ? f.getRange(ligneCout, COL_PRODUITS, 1, nb).getValues()[0] : [];
  noms.forEach((nom, j) => comparer(nom, prix[j], couts[j], FEUILLE,
    f.getRange(ligne, COL_PRODUITS + j)));

  // « Boissons » : nom en A, prix d'achat en B, prix de vente en C.
  const b = SpreadsheetApp.getActive().getSheetByName(FEUILLE_BOISSONS);
  if (b && b.getLastRow() > 1) {
    b.getRange(2, 1, b.getLastRow() - 1, 3).getValues().forEach((l, i) =>
      comparer(l[0], l[2], l[1], FEUILLE_BOISSONS, b.getRange(i + 2, 3)));
  }

  const introuvables = Object.values(voulu).filter((v) => !v.vu).map((v) => v.nom);
  return { changements: changements, inchanges: inchanges, horsAffiche: horsAffiche, introuvables: introuvables };
}

/** Une ligne lisible par changement, avec l'alerte de marge s'il y a lieu. */
function texteChangement_(c) {
  const avant = typeof c.avant === 'number' ? c.avant : 'vide';
  let t = `- ${c.nom} : ${avant} -> ${c.apres} DH`;
  if (c.cout !== null && c.apres - c.cout < MARGE_MINIMALE) {
    t += `   ATTENTION : coût ${Math.round(c.cout * 100) / 100} DH, marge ${Math.round((c.apres - c.cout) * 100) / 100} DH`;
  }
  return t;
}

/** Menu « Aligner les prix sur l'affiche ». */
function alignerPrixAffiche() {
  const ui = SpreadsheetApp.getUi();
  try {
    const e = ecartsAffiche_();
    const notes = [];
    if (e.horsAffiche.length) {
      notes.push(`Pas sur l'affiche, prix laissé tel quel : ${e.horsAffiche.join(', ')}.`);
    }
    const aCreer = e.introuvables.concat(AFFICHE_SANS_PRODUIT);
    if (aCreer.length) {
      notes.push(`Sur l'affiche mais introuvable dans la fiche (à créer, ou nom à corriger dans PRIX_AFFICHE) : ${aCreer.join(', ')}.`);
    }

    if (!e.changements.length) {
      ui.alert('Prix de l\'affiche',
        ['Tous les prix de la fiche sont déjà ceux de l\'affiche.'].concat(notes).join('\n\n'),
        ui.ButtonSet.OK);
      return;
    }

    const message = [
      `${e.changements.length} prix à changer :`,
      e.changements.map(texteChangement_).join('\n'),
    ].concat(notes, ['Appliquer ces changements ?']).join('\n\n');
    if (ui.alert('Aligner les prix sur l\'affiche', message, ui.ButtonSet.YES_NO) !== ui.Button.YES) {
      ui.alert('Rien n\'a été changé.');
      return;
    }

    e.changements.forEach((c) => c.ecrire());
    SpreadsheetApp.flush();

    const envoyer = ui.alert('Prix changés',
      `${e.changements.length} prix écrits dans la fiche.\n\n`
      + 'L\'appli garde les anciens prix jusqu\'au prochain envoi. Envoyer maintenant ?',
      ui.ButtonSet.YES_NO);
    if (envoyer === ui.Button.YES) envoyerPrixAppli();
  } catch (err) {
    ui.alert(`Impossible : ${err.message}\n\nRien n'a été écrit si cette fenêtre arrive avant la liste des changements.`);
  }
}
