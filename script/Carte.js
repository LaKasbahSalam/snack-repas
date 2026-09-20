/**
 * Menu « Compléter depuis la carte » : ajoute à l'onglet « Cout par item »
 * les produits de la carte (Snacks and Drinks.dc.html) et les ingrédients
 * qui manquent, sans rien toucher à ce qui existe déjà.
 *
 * Produits et ingrédients sont reconnus par leur nom (sans accents ni
 * majuscules) : relancer ne rajoute rien. Les recettes ne sont écrites que
 * dans les colonnes créées ici. Une quantité connue par analogie (le panini
 * chameau reprend le panini kefta) est écrite ; une quantité inconnue est
 * laissée vide sur fond jaune, à remplir.
 *
 * Les boissons n'ont pas de recette : elles vivent dans l'onglet « Boissons »
 * (Boissons.js), pas ici.
 *
 * Prix de vente des nouveaux produits : ceux de la carte. Les produits déjà
 * présents gardent le leur ; les écarts avec la carte sont seulement signalés.
 */

const A_REMPLIR = null; // dans la recette : ingrédient présent, quantité à saisir
const JAUNE = '#fff2cc';

// Ingrédients déjà dans la feuille dont les recettes ci-dessous ont besoin.
const INGREDIENTS_EXISTANTS = ['Pain panini', 'Pain Burger', 'frites', 'kefta', 'tomate', 'oignons', 'sauce', 'Avocat'];

// Ajoutés s'ils manquent, dans cet ordre, sous les ingrédients existants.
const INGREDIENTS_CARTE = [
  'fromage', 'viande de chameau', 'oeufs', "huile d'olive", 'épices', 'pain (tajine)',
];

// Produits de la carte absents de la feuille : nom, prix carte, recette.
const PRODUITS_CARTE = [
  ['P.Chameau', 50, { 'Pain panini': 1, 'viande de chameau': 5, tomate: 0.5, oignons: 0.5, sauce: 1, fromage: A_REMPLIR }],
  ['Burger chameau', 50, { 'Pain Burger': 1, 'viande de chameau': 5, tomate: 0.5, oignons: 0.5, sauce: 1 }],
  ['Menu (+frites)', 10, { frites: 1 }],
  ['Tajine kefta', 60, { kefta: A_REMPLIR, tomate: A_REMPLIR, oignons: A_REMPLIR, oeufs: A_REMPLIR, épices: A_REMPLIR, 'pain (tajine)': A_REMPLIR }],
  ['Tajine chameau', 70, { 'viande de chameau': A_REMPLIR, tomate: A_REMPLIR, oignons: A_REMPLIR, oeufs: A_REMPLIR, épices: A_REMPLIR, 'pain (tajine)': A_REMPLIR }],
];

// Prix de la carte des produits déjà présents : comparés, jamais écrits.
const PRIX_CARTE_EXISTANTS = {
  'Frites': 20, 'Frites et nuggets': 30, 'Burger': 40,
  'PaniniKefta': 40, 'P.kefNug': 50, 'P.NugDinde': 30, 'Sandwich': 35,
};

function completerDepuisCarte() {
  const ui = SpreadsheetApp.getUi();
  try {
    const f = feuille_();
    let der = derniereLigneIngredient_(f);
    let derCol = derniereColonneProduit_(f);

    const lignesIng = () => {
      const m = {};
      f.getRange(PREMIERE_LIGNE, 2, der - PREMIERE_LIGNE + 1, 1).getValues()
        .forEach((l, i) => { const k = cle_(l[0]); if (k && !m[k]) m[k] = PREMIERE_LIGNE + i; });
      return m;
    };
    const colonnesProd = () => {
      const m = {};
      f.getRange(LIGNE_ENTETE, COL_PRODUITS, 1, derCol - COL_PRODUITS + 1).getValues()[0]
        .forEach((v, j) => { const k = cle_(v); if (k && !m[k]) m[k] = COL_PRODUITS + j; });
      return m;
    };

    // Vérifier avant de toucher à quoi que ce soit.
    const ing = lignesIng();
    const absents = INGREDIENTS_EXISTANTS.filter((n) => !ing[cle_(n)]);
    if (absents.length) {
      throw new Error(`ingrédient(s) introuvable(s) en colonne B : ${absents.join(', ')}. `
        + 'Ont-ils été renommés ? Rien n\'a été modifié.');
    }
    const nouveauxIng = INGREDIENTS_CARTE.filter((n) => !ing[cle_(n)]);
    const prod = colonnesProd();
    const nouveauxProd = PRODUITS_CARTE.filter(([nom]) => !prod[cle_(nom)]);
    if (!nouveauxIng.length && !nouveauxProd.length) {
      ui.alert('La feuille contient déjà tout ce qui est sur la carte.');
      return;
    }

    const ok = ui.alert('Compléter depuis la carte',
      `Ingrédients ajoutés (${nouveauxIng.length}) : ${nouveauxIng.join(', ') || '—'}\n\n`
      + `Produits ajoutés (${nouveauxProd.length}) : ${nouveauxProd.map((p) => p[0]).join(', ') || '—'}\n\n`
      + 'Rien d\'existant n\'est modifié. Continuer ?', ui.ButtonSet.OK_CANCEL);
    if (ok !== ui.Button.OK) return;

    // 1. Ingrédients : une ligne chacun sous le dernier, 0 partout.
    nouveauxIng.forEach((nom) => {
      f.insertRowAfter(der);
      der++;
      f.getRange(der, 2).setValue(nom);
      f.getRange(der, COL_PRODUITS, 1, derCol - COL_PRODUITS + 1)
        .setValues([new Array(derCol - COL_PRODUITS + 1).fill(0)]);
    });

    // 2. Produits : une colonne chacun après le dernier, 0 partout, puis la recette.
    const ligneDe = lignesIng();
    const nbIng = der - PREMIERE_LIGNE + 1;
    nouveauxProd.forEach(([nom, , recette]) => {
      f.insertColumnAfter(derCol);
      derCol++;
      f.getRange(LIGNE_ENTETE, derCol).setValue(nom);
      f.getRange(PREMIERE_LIGNE, derCol, nbIng, 1).setValues(new Array(nbIng).fill([0])).setBackground(null);
      Object.entries(recette).forEach(([ingNom, qte]) => {
        const c = f.getRange(ligneDe[cle_(ingNom)], derCol);
        if (qte === A_REMPLIR) c.clearContent().setBackground(JAUNE);
        else c.setValue(qte);
      });
    });

    // 3. Fromage tout juste créé : la carte le met dans tous les paninis.
    if (nouveauxIng.some((n) => cle_(n) === 'fromage')) {
      const r = ligneDe.fromage;
      Object.entries(colonnesProd()).forEach(([k, c]) => {
        if (/^p |panini/.test(k)) f.getRange(r, c).clearContent().setBackground(JAUNE);
      });
    }

    // 4. Prix de vente des nouveaux produits (repris par mettreAJour).
    const memo = lireMemo_();
    nouveauxProd.forEach(([nom, prix]) => { if (memo.prix[nom] == null) memo.prix[nom] = prix; });
    ecrireMemo_(memo);
    mettreAJour();

    // 5. Écarts de prix avec la carte, produits existants.
    const apres = lireMemo_().prix;
    const ecarts = Object.entries(PRIX_CARTE_EXISTANTS)
      .filter(([nom, carte]) => apres[nom] != null && apres[nom] !== carte)
      .map(([nom, carte]) => `${nom} : ${apres[nom]} dans la feuille, ${carte} sur la carte`);
    ui.alert('Carte ajoutée',
      'Cases jaunes vides = quantités à remplir. Lignes orange en colonne E = prix d\'achat à saisir.'
      + (ecarts.length ? `\n\nPrix différents de la carte (non modifiés) :\n${ecarts.join('\n')}` : ''),
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert(`Impossible : ${e.message}`);
  }
}

/** Nom ramené à une clé : sans accents, minuscules, ponctuation en espaces. */
function cle_(v) {
  return String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
