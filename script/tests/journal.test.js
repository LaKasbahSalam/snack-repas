/**
 * Ce que `tirerVentesSnack_()` écrit dans l'onglet « Journal Snack ».
 *
 *   node tests/journal.test.js
 *
 * L'enjeu : ce script écrit dans un journal comptable, et accuse réception
 * auprès de l'appli. Une vente accusée mais non écrite est perdue pour
 * toujours — l'appli ne la proposera plus. Les cas qui tournent mal
 * comptent donc autant que le cas normal, et sont testés ici.
 *
 * Depuis le 27/09/2026 : une ligne par article, les faits en valeurs, tout
 * le reste en formules qui renvoient à « Carte appli ».
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { grilleVide, FausseFeuille, fauxContexte } = require("./faux-sheets");

const SCRIPT = path.join(__dirname, "..");
const FICHIERS = ["Snack.js", "CarteAppli.js", "PartVendeur.js", "JournalSnack.js"];
let echecs = 0;
const verifier = (condition, titre, vu) => {
  if (condition) console.log(`  ok   ${titre}`);
  else { console.log(`  ÉCHEC ${titre} — vu : ${vu}`); echecs++; }
};

// Ce que rend la base depuis 20260927110000 : une ligne par article.
const LIGNES = [
  { id: 2, ligne_id: 10, date_vente: "2026-09-20", description: "Panini kefta + frites (ketchup) x 2 - Alice - vendu par momo",
    client: "Alice", vendeur: "momo", code: "panini_kefta", quantite: 2, prix_unitaire: 50, avec_frites: true },
  { id: 2, ligne_id: 11, date_vente: "2026-09-20", description: "Bière x 3 - Alice - vendu par momo",
    client: "Alice", vendeur: "momo", code: "biere", quantite: 3, prix_unitaire: 35, avec_frites: false },
  { id: 3, ligne_id: 12, date_vente: "2026-09-20", description: "Coca x 3 - Passant - vendu par momo",
    client: "Passant", vendeur: "momo", code: "coca", quantite: 3, prix_unitaire: 12, avec_frites: false },
];

/**
 * « Carte appli » telle que Sheets la montre après preparerPartsVendeur_ :
 * les renvois y sont déjà calculés (le faux Sheets ne calcule rien).
 * Colonne H « Retenue » laissée d'avant, comme sur le vrai classeur.
 */
function carte() {
  const g = grilleVide(10, 10);
  g[0] = ["Rubrique", "Article", "Produit de la fiche", "Sauce", "Frites", "Code", "Prix envoyé", "Retenue",
    "Coût revient", "Part vendeur"];
  g[1] = ["Paninis", "Panini kefta", "PaniniKefta", true, true, "panini_kefta", 40, 5, 18.33, 0.8];
  g[2] = ["Boissons", "Bière", "Bière", false, false, "biere", 35, 35, 16, 0];
  g[3] = ["Boissons", "Coca", "Coca / Hawai", false, false, "coca", 12, 1, 6, 0.8];
  g[4] = ["Plats", "Tajine", "Tajine kefta", false, false, "tajine_kefta", 60, 5, "", 0.8];
  g[5] = ["Supplément", "Avec frites", "Menu (+frites)", false, false, "menu_frites", 10, 5, 4, ""];
  return g;
}

/** Fait tourner un tirage et rend ce qui s'est passé. */
function tirer({ lignes = LIGNES, journal = grilleVide(12, 15), grilleCarte = carte(), accuseEchoue = false } = {}) {
  const feuille = new FausseFeuille(journal);
  const feuilles = { "Journal Snack": feuille };
  if (grilleCarte) feuilles["Carte appli"] = new FausseFeuille(grilleCarte);
  const { ctx, appels } = fauxContexte(feuilles, (corps) => {
    if (corps.action === "ventes") {
      return { code: 200, corps: JSON.stringify({ ok: true, ventes: lignes }) };
    }
    return accuseEchoue
      ? { code: 500, corps: "panne" }
      : { code: 200, corps: JSON.stringify({ ok: true, marquees: corps.ids.length }) };
  });
  vm.createContext(ctx);
  FICHIERS.forEach((f) => vm.runInContext(fs.readFileSync(path.join(SCRIPT, f), "utf8"), ctx, { filename: f }));
  const ecrites = vm.runInContext("tirerVentesSnack_('secret-de-test')", ctx);
  return { ecrites, grille: feuille.g, f: feuille.formulesA1, appels };
}

// 1. Onglet vierge : une ligne par article.
let r = tirer();
verifier(r.ecrites === 3, "3 articles écrits (2 ventes)", r.ecrites);
verifier(r.grille[0].join("|") === "Id|Date|Description|Montant|Montant total cumule|Client|Vendeur|"
  + "Part vendeur|Part hotel|Cout|Benefice|Commission hotel|Code|Quantite|Prix unitaire",
  "en-têtes posées sur un onglet vierge, M à O en plus", r.grille[0].join(" | "));
verifier(r.grille[1][0] === 2 && r.grille[2][0] === 2 && r.grille[3][0] === 3,
  "numéro de la vente répété sur chacun de ses articles", `${r.grille[1][0]} ${r.grille[2][0]} ${r.grille[3][0]}`);
verifier(typeof r.grille[1][1].getDate === "function" && r.grille[1][1].getDate() === 20 && r.grille[1][1].getMonth() === 8,
  "date écrite comme vraie date (20/09)", String(r.grille[1][1]));
verifier(r.grille[1][5] === "Alice" && r.grille[1][6] === "momo"
  && r.grille[1][12] === "panini_kefta" && r.grille[1][13] === 2 && r.grille[1][14] === 50,
  "faits en valeurs : client, vendeur, code, quantité, prix payé", r.grille[1].join(" | "));

verifier(r.f.D2 === "=N2*O2" && r.f.E2 === "=D2" && r.f.E3 === "=N(E2)+D3",
  "montant = quantité × prix, cumul en formule", JSON.stringify([r.f.D2, r.f.E2, r.f.E3]));
verifier(r.f.J2 === "=N2*('Carte appli'!I2+'Carte appli'!I6)",
  "coût du panini avec frites : renvoi au coût de l'article + celui des frites", r.f.J2);
verifier(r.f.J3 === "=N3*'Carte appli'!I3", "coût de la bière : renvoi à son coût", r.f.J3);
verifier(r.f.L2 === "=1-'Carte appli'!J2" && r.f.L3 === "=1-'Carte appli'!J3",
  "commission hôtel = 1 − part vendeur de l'article", `${r.f.L2} ${r.f.L3}`);
verifier(r.f.H2 === "=(K2>0)*ROUND(100*K2*(1-L2))/100" && r.f.I2 === "=D2-H2" && r.f.K2 === "=D2-J2",
  "parts et bénéfice en formules", JSON.stringify([r.f.H2, r.f.I2, r.f.K2]));
const calculees = r.grille.slice(1, 4).map((l) => [l[3], l[4], l[7], l[8], l[9], l[10], l[11]]);
verifier(calculees.every((l) => l.every((v) => typeof v === "string" && v.startsWith("="))),
  "D, E et H à L : que des formules, aucun chiffre écrit", JSON.stringify(calculees));
verifier(Object.values(r.f).every((x) => !/[,;]/.test(x)),
  "aucune formule ne dépend du séparateur de la langue (ni « , » ni « ; »)", JSON.stringify(r.f));

// Ce que Sheets calculera, refait ici avec les valeurs de « Carte appli ».
const calcul = (q, prix, cout, part) => {
  const d = q * prix, k = d - q * cout;
  return (k > 0 ? 1 : 0) * Math.round(100 * k * part) / 100;
};
verifier(calcul(2, 50, 18.33 + 4, 0.8) === 44.27, "panini ×2 avec frites : part vendeur 44,27 (80 % de 55,34)", "");
verifier(calcul(3, 35, 16, 0) === 0, "bière ×3 : part vendeur 0 (0 % du bénéfice)", "");
verifier(JSON.stringify(r.appels[1]) === JSON.stringify({ action: "ventes_ack", ids: [2, 3] }),
  "accusé une fois par vente, pas par article", JSON.stringify(r.appels[1]));

// 2. Coût inconnu ou article absent de la carte : bénéfice nul, rien pour le vendeur.
r = tirer({ lignes: [
  { id: 8, date_vente: "2026-09-27", description: "Tajine", client: "X", vendeur: "momo", code: "tajine_kefta", quantite: 1, prix_unitaire: 60, avec_frites: false },
  { id: 9, date_vente: "2026-09-27", description: "Nouveau", client: "X", vendeur: "momo", code: "inconnu", quantite: 1, prix_unitaire: 20, avec_frites: false },
] });
verifier(r.f.J2 === "=D2" && r.f.J3 === "=D3", "coût inconnu ou article hors carte : J = D (bénéfice nul)", `${r.f.J2} ${r.f.J3}`);
verifier(r.f.L3 === "=1", "article hors carte : commission hôtel 100 %", r.f.L3);

// 3. Une vente déjà dans l'onglet : pas de doublon même si un accusé s'est perdu.
const dejaLa = grilleVide(12, 15);
dejaLa[0] = ["Id", "Date", "Description", "Prix", "Prix total cumule", "nom client", "Vendeur",
  "pour l'hotel", "pour le vendeur", "", "", "", "", "", ""];
dejaLa[1] = [2, new Date(2026, 8, 20, 12), "déjà écrite", 100, 100, "Alice", "momo", 0, 100, "", "", "", "", "", ""];
r = tirer({ journal: dejaLa });
verifier(r.ecrites === 1 && r.grille[2][0] === 3, "vente déjà présente non réécrite, la nouvelle s'ajoute en bas", r.ecrites);
verifier(r.f.E3 === "=N(E2)+D3", "le cumul reprend la ligne du dessus", r.f.E3);
verifier(r.grille[0][3] === "Prix" && r.grille[0][7] === "pour l'hotel" && r.grille[0][9] === "Cout"
  && r.grille[0][12] === "Code",
  "en-têtes existantes jamais réécrites, les manquantes ajoutées", r.grille[0].join(" | "));
verifier(r.grille[1][2] === "déjà écrite" && r.grille[1][3] === 100, "ligne existante jamais touchée", r.grille[1].join(" | "));
verifier(JSON.stringify(r.appels[1]) === JSON.stringify({ action: "ventes_ack", ids: [3] }),
  "accusé sur la vente écrite seulement", JSON.stringify(r.appels[1]));

// 4. L'accusé échoue : les lignes restent écrites, rien n'est perdu.
r = tirer({ accuseEchoue: true });
verifier(r.grille[1][0] === 2 && r.grille[3][0] === 3, "accusé en panne : les lignes sont quand même dans l'onglet", "");
verifier(r.ecrites === 0, "accusé en panne : annoncé 0, les ventes repartiront au prochain passage", r.ecrites);

// 5. Base pas encore migrée : ancien format, rien n'est écrit ni accusé.
r = tirer({ lignes: [{ id: 7, date_vente: "2026-09-21", description: "Coca", montant: 12, part_vendeur: 5, part_hotel: 7 }] });
verifier(r.ecrites === 0 && r.grille[1][0] === "" && r.appels.length === 1,
  "ancien format : rien d'écrit, aucun accusé, les ventes attendent", JSON.stringify(r.appels));

// 6. « Carte appli » sans ses colonnes Coût revient / Part vendeur : rien d'écrit.
const sansColonnes = carte().map((l) => l.slice(0, 8).concat(["", ""]));
r = tirer({ grilleCarte: sansColonnes });
verifier(r.ecrites === 0 && r.grille[1][0] === "" && r.appels.length === 1,
  "carte sans les colonnes de renvoi : rien d'écrit, aucun accusé", JSON.stringify(r.appels));

// 7. Rien à écrire : aucun accusé inutile.
r = tirer({ lignes: [] });
verifier(r.ecrites === 0 && r.appels.length === 1, "aucune vente : un seul appel, pas d'accusé", JSON.stringify(r.appels));

// 8. Onglet absent du classeur : le tirage se tait, l'envoi des prix continue.
const sansOnglet = fauxContexte({}, () => ({ code: 200, corps: "{}" }));
vm.createContext(sansOnglet.ctx);
FICHIERS.forEach((f) => vm.runInContext(fs.readFileSync(path.join(SCRIPT, f), "utf8"), sansOnglet.ctx, { filename: f }));
verifier(vm.runInContext("tirerVentesSnack_('secret-de-test')", sansOnglet.ctx) === 0 && sansOnglet.appels.length === 0,
  "onglet Journal Snack absent : rien n'est demandé, rien ne casse", "");

console.log(echecs === 0 ? "\nTout passe.\n" : `\n${echecs} échec(s).\n`);
process.exit(echecs === 0 ? 0 : 1);
