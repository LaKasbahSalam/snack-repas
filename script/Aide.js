/**
 * Menu « Poser les modes d'emploi » (aussi lancé par « Mettre en forme la
 * fiche ») : dit sur chaque onglet à quoi il sert et comment s'en servir.
 *
 *   - un onglet « Mode d'emploi », en premier : le tour complet ;
 *   - une note sur la case A1 de chaque onglet : le résumé, au survol ;
 *   - « Journal Snack » : une note par colonne (envoyée par l'appli ou
 *     calculée), en-têtes calculés grisés, et une protection d'avertissement
 *     sur tout l'onglet (le script y écrit librement : l'avertissement ne
 *     vise que les saisies à la main).
 *
 * Pourquoi des notes et pas une ligne d'explication en haut : les onglets
 * sont lus par position (noms des plats en ligne 2 de « Items & Sandwichs »,
 * en-têtes en ligne 1 ailleurs). Insérer une ligne casserait les scripts
 * et les recherches. Une note ne déplace rien.
 */

const FEUILLE_AIDE = "Mode d'emploi";
const FEUILLE_JOURNAL_SNACK = 'Journal Snack';

// [onglet, à quoi il sert, comment s'en servir] — aussi le texte des notes A1.
// Une fonction : les noms d'onglets viennent d'autres fichiers, pas encore lus au chargement.
function aides_() {
  return [
  [FEUILLE, 'La fiche technique : une ligne par ingrédient, une colonne par plat. Le coût de revient, la marge et le prix conseillé de chaque plat se calculent en bas.',
    'On SAISIT ici : quantité achetée et prix payé (C, D), quantités par plat (cases vertes ; vide = pas dans le plat), « Prix de vente » et « Part vendeur » sous chaque plat. Nouveau plat : Snack → « Ajouter un produit » ; nouvel ingrédient : « Ajouter un ingrédient ». Ne pas renommer les lignes du bloc (« Coût revient », « Prix de vente », « Part vendeur »…) : le script les retrouve par leur nom.'],
  [FEUILLE_BOISSONS, 'Les boissons : prix d\'achat, prix de vente, prix pour l\'équipe et part du vendeur.',
    'On SAISIT ici. « Prix équipe » : prix cédé à l\'équipe (6 DH par défaut). « Code équipe » : posé par Snack → « Ajouter à la page Snack de l\'équipe ». Part vendeur de la bière : 0 %.'],
  [FEUILLE_PLATS, 'Le tableau de bord des plats : un plat ou une boisson par ligne, avec ses ingrédients, son coût, sa marge et la part du vendeur.',
    'LECTURE SEULE : tout est recalculé depuis « Items & Sandwichs » et « Boissons ». Trier ou filtrer avec les flèches des en-têtes. Coût / prix en rouge = au-dessus de l\'objectif (35 %). Après l\'ajout d\'un plat : Snack → « Mettre en forme la fiche ».'],
  [FEUILLE_CARTE, 'Ce que l\'équipe vend dans l\'appli : une ligne par article, avec son code.',
    'On SAISIT A à F : rubrique, nom affiché, nom exact du plat dans la fiche (C), sauce, frites, code. Un code ne se change JAMAIS (les ventes passées le portent) ; le nom et le prix, si. Les colonnes grises sont calculées. Puis Snack → « Envoyer les prix à l\'appli ».'],
  [FEUILLE_JOURNAL_SNACK, 'Les ventes du snack faites dans l\'appli, une ligne par article, et la prime de chaque vente.',
    'LECTURE SEULE : les ventes arrivent à chaque « Envoyer les prix à l\'appli » et chaque soir. Les calculs (en-têtes gris) suivent la fiche : changer un coût ou une part change aussi les ventes passées. Une vente fausse se corrige dans l\'appli.'],
  ['Journal Repas', 'Les repas de groupe : dépenses, recette, nombre de personnes, qui encaisse.',
    'On SAISIT ici, une ligne par repas. « Revenu net » se calcule.'],
  ];
}

// Journal Snack : [en-tête, d'où ça vient]. Les colonnes absentes sont ignorées.
const COLONNES_JOURNAL = {
  'Id': "Envoyé par l'appli : numéro de la vente (le même pour ses articles).",
  'date': "Envoyé par l'appli : jour de la vente.",
  'description': "Envoyé par l'appli : article, client, vendeur.",
  'Prix': 'Calculé : quantité × prix unitaire.',
  'Prix total cumule': 'Calculé : cumul des montants.',
  'nom client': "Envoyé par l'appli.",
  'Vendeur': "Envoyé par l'appli.",
  'Pour le vendeur': 'Calculé : bénéfice × part vendeur (réglée dans « Items & Sandwichs » ou « Boissons »).',
  "pour l'hotel": 'Calculé : montant − part du vendeur.',
  'Cout': 'Calculé : coût de revient (« Carte appli », lu dans la fiche) × quantité, frites comprises.',
  'Benefice': 'Calculé : montant − coût.',
  'Commission hotel': 'Calculé : 1 − part vendeur de l\'article.',
  'Code': "Envoyé par l'appli : sert à retrouver l'article dans « Carte appli ».",
  'Quantite': "Envoyé par l'appli.",
  'Prix unitaire': "Envoyé par l'appli : prix payé à la pièce, frites comprises.",
  'Frites': "Envoyé par l'appli : VRAI si pris avec frites.",
};

function poserModesDEmploi() {
  const ss = SpreadsheetApp.getActive();

  // 1. Une note sur A1 de chaque onglet présent.
  aides_().forEach(([nom, sert, usage]) => {
    const f = ss.getSheetByName(nom);
    if (f) f.getRange(1, 1).setNote(`À QUOI ÇA SERT\n${sert}\n\nCOMMENT S'EN SERVIR\n${usage}`);
  });

  // 2. Journal Snack : chaque colonne dit d'où elle vient.
  const j = ss.getSheetByName(FEUILLE_JOURNAL_SNACK);
  if (j && j.getLastColumn() > 0) {
    const entetes = j.getRange(1, 1, 1, j.getLastColumn()).getValues()[0];
    entetes.forEach((e, i) => {
      const cle = Object.keys(COLONNES_JOURNAL).find((k) => k.toLowerCase() === String(e).trim().toLowerCase());
      if (!cle) return;
      const note = COLONNES_JOURNAL[cle];
      const r = j.getRange(1, i + 1);
      if (i > 0) r.setNote(note); // A1 porte le mode d'emploi de l'onglet
      r.setBackground(note.startsWith('Calculé') ? '#d9d9d9' : '#cfe2f3');
    });
    const desc = `Lecture : ${FEUILLE_JOURNAL_SNACK}`;
    j.getProtections(SpreadsheetApp.ProtectionType.SHEET)
      .filter((pr) => pr.getDescription() === desc).forEach((pr) => pr.remove());
    j.protect().setDescription(desc).setWarningOnly(true);
  }

  // 3. L'onglet « Mode d'emploi », en premier.
  let a = ss.getSheetByName(FEUILLE_AIDE);
  if (a && String(a.getRange(1, 1).getValue()).trim() !== FEUILLE_AIDE) {
    throw new Error(`Un onglet « ${FEUILLE_AIDE} » existe déjà et n'a pas été fait par ce menu. Renommez-le, puis relancez.`);
  }
  if (!a) a = ss.insertSheet(FEUILLE_AIDE, 0);
  const lignes = [
    [FEUILLE_AIDE, ''],
    ['Le principe', 'On saisit les recettes et les prix dans « Items & Sandwichs » et « Boissons ». Tout le reste les relit. L\'appli envoie les ventes, le classeur calcule le coût, le bénéfice et la prime du vendeur. Bleu = on saisit ou ça vient de l\'appli ; gris = calculé, ne pas taper.'],
    ['Le chemin d\'une vente', 'Vente dans l\'appli (avec un code) → « Journal Snack » → cherche le code dans « Carte appli » → qui lit le coût et la part vendeur dans « Items & Sandwichs » ou « Boissons ».'],
    ['', ''],
    ['Onglet', 'À quoi il sert — comment s\'en servir'],
    ...aides_().map(([nom, sert, usage]) => [nom, `${sert}\n${usage}`]),
    ['', ''],
    ['Ajouter un plat', '1. « Ajouter un produit », renommer la colonne (ligne 2). 2. Taper ses quantités, son prix de vente, sa part vendeur. 3. « Mettre en forme la fiche ». 4. Une ligne dans « Carte appli » avec un code neuf. 5. « Envoyer les prix à l\'appli ».'],
    ['Changer un prix', 'Le taper dans « Items & Sandwichs » (ligne « Prix de vente ») ou « Boissons », puis « Envoyer les prix à l\'appli ».'],
    ['Si une case est vide dans « Carte appli »', 'Le nom en colonne C ne correspond à aucun plat : le corriger pour qu\'il soit écrit comme en ligne 2 de la fiche.'],
    ['Survol', 'La case A1 de chaque onglet porte son mode d\'emploi en note (passer la souris dessus).'],
  ];
  a.getRange(1, 1, a.getMaxRows(), 2).clearContent();
  a.getRange(1, 1, lignes.length, 2).setValues(lignes).setWrap(true).setVerticalAlignment('top');
  a.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  a.getRange(5, 1, 1, 2).setFontWeight('bold').setBackground('#cfe2f3');
  a.getRange(1, 1, lignes.length, 1).setFontWeight('bold');
  a.setColumnWidth(1, 220);
  a.setColumnWidth(2, 700);
  return lignes.length;
}
