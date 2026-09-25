/**
 * Ce que `tirerVentesSnack_()` écrit dans l'onglet « Journal Snack ».
 *
 *   node tests/journal.test.js
 *
 * L'enjeu : ce script écrit dans un journal comptable, et accuse réception
 * auprès de l'appli. Une vente accusée mais non écrite est perdue pour
 * toujours — l'appli ne la proposera plus. Les cas qui tournent mal
 * comptent donc autant que le cas normal, et sont testés ici.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { grilleVide, FausseFeuille, fauxContexte } = require("./faux-sheets");

const SCRIPT = path.join(__dirname, "..");
let echecs = 0;
const verifier = (condition, titre, vu) => {
  if (condition) console.log(`  ok   ${titre}`);
  else { console.log(`  ÉCHEC ${titre} — vu : ${vu}`); echecs++; }
};

const VENTES = [
  { id: 2, date_vente: "2026-09-20", description: "Panini kefta + frites (ketchup) x 2 - Alice - vendu par momo", montant: 100,
    client: "Alice", vendeur: "momo", part_vendeur: 33.34, part_hotel: 66.66 },
  { id: 3, date_vente: "2026-09-20", description: "Coca / Hawai x 3 - Passant - vendu par momo", montant: 36,
    client: "Passant", vendeur: "momo", part_vendeur: 0, part_hotel: 36 },
];

/** Fait tourner un tirage et rend ce qui s'est passé. */
function tirer({ ventes = VENTES, journal = grilleVide(10, 10), accuseEchoue = false } = {}) {
  const feuille = new FausseFeuille(journal);
  const { ctx, appels } = fauxContexte({ "Journal Snack": feuille }, (corps) => {
    if (corps.action === "ventes") {
      return { code: 200, corps: JSON.stringify({ ok: true, ventes }) };
    }
    return accuseEchoue
      ? { code: 500, corps: "panne" }
      : { code: 200, corps: JSON.stringify({ ok: true, marquees: corps.ids.length }) };
  });
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(SCRIPT, "JournalSnack.js"), "utf8"), ctx,
    { filename: "JournalSnack.js" });
  const ecrites = vm.runInContext("tirerVentesSnack_('secret-de-test')", ctx);
  return { ecrites, grille: feuille.g, formules: feuille.formules, formulesA1: feuille.formulesA1, appels };
}

// 1. Onglet vierge.
let r = tirer();
verifier(r.ecrites === 2, "2 ventes écrites", r.ecrites);
verifier(r.grille[0][0] === "Id" && r.grille[0][4] === "Montant total cumule",
  "en-tête posé sur un onglet vierge", r.grille[0].join(" | "));
verifier(r.grille[1][0] === 2 && r.grille[1][3] === 100,
  "identifiant et montant en place", r.grille[1].join(" | "));
verifier(typeof r.grille[1][1].getDate === "function"
  && r.grille[1][1].getDate() === 20 && r.grille[1][1].getMonth() === 8,
  "date écrite comme vraie date (20/09)", String(r.grille[1][1]));
verifier(r.formules[2] === "=D2" && r.formules[3] === "=N(E2)+D3",
  "cumul écrit en formule, pas en valeur", JSON.stringify(r.formules));
verifier(JSON.stringify(r.appels[1]) === JSON.stringify({ action: "ventes_ack", ids: [2, 3] }),
  "accusé de réception sur les deux ventes", JSON.stringify(r.appels[1]));

verifier(r.grille[0].slice(5, 9).join("|") === "Client|Vendeur|Part vendeur|Part hotel",
  "en-têtes F à I sur un onglet vierge", r.grille[0].join(" | "));
verifier(r.grille[1][5] === "Alice" && r.grille[1][6] === "momo"
  && r.grille[1][7] === 33.34 && r.grille[1][8] === 66.66,
  "client, vendeur, part vendeur, part hôtel en F à I", r.grille[1].join(" | "));
verifier(r.grille[2][7] === 0 && r.grille[2][8] === 36,
  "prime nulle écrite 0, pas vide", r.grille[2].join(" | "));
// 2. Une vente déjà dans l'onglet : pas de doublon même si un accusé s'est perdu.
const dejaLa = grilleVide(10, 10);
dejaLa[0] = ["Id", "Date", "Description", "Montant", "Montant total cumule", "", "", "", "", ""];
dejaLa[1] = [2, new Date(2026, 8, 20, 12), "déjà écrite à la main", 100, 100, "", "", "", "", ""];
r = tirer({ journal: dejaLa });
verifier(r.ecrites === 1, "vente déjà présente non réécrite, la nouvelle oui", r.ecrites);
verifier(r.grille[2][0] === 3, "la nouvelle s'ajoute en bas", r.grille[2].join(" | "));
verifier(r.formules[3] === "=N(E2)+D3", "le cumul reprend la ligne du dessus", JSON.stringify(r.formules));

verifier(r.grille[0].slice(5, 9).join("|") === "Client|Vendeur|Part vendeur|Part hotel"
  && r.grille[0][0] === "Id" && r.grille[0][4] === "Montant total cumule",
  "onglet d'avant le 21/09 : en-têtes F à I ajoutées, A à E intactes", r.grille[0].join(" | "));
verifier(r.grille[1][2] === "déjà écrite à la main" && r.grille[1][5] === "",
  "ligne existante jamais touchée", r.grille[1].join(" | "));
// 3. L'accusé échoue : les lignes restent écrites, rien n'est perdu.
r = tirer({ accuseEchoue: true });
verifier(r.grille[1][0] === 2 && r.grille[2][0] === 3,
  "accusé en panne : les lignes sont quand même dans l'onglet", "lignes manquantes");
verifier(r.ecrites === 0,
  "accusé en panne : annoncé comme 0 écrite, les ventes repartiront au prochain passage", r.ecrites);

// 3 bis. Base pas encore migrée : ni client, ni vendeur, ni parts.
r = tirer({ ventes: [{ id: 7, date_vente: "2026-09-21", description: "Coca - Passant - vendu par momo", montant: 12 }] });
verifier(r.ecrites === 1 && r.grille[1][3] === 12,
  "ancienne réponse de la base : la vente s'écrit quand même", r.grille[1].join(" | "));
verifier(r.grille[1].slice(5, 9).every((v) => v === ""),
  "et F à I restent vides, sans 0 inventé", r.grille[1].join(" | "));
// 3 ter. Depuis le 25/09/2026 : coût et taux remontent, le partage devient
// une formule sur ces cases. Chiffres de l'appli (test de la migration
// 20260925100000) : 100 vendus, 44,66 de coût, 20 % -> prime 44,27.
const AVEC_TAUX = [
  { id: 8, date_vente: "2026-09-25", description: "Panini kefta + frites (ketchup) x 2 - Alice - vendu par momo",
    montant: 100, client: "Alice", vendeur: "momo", part_vendeur: 44.27, part_hotel: 55.73,
    cout: 44.66, commission_hotel: 20 },
  { id: 9, date_vente: "2026-09-25", description: "Coca / Hawai - Passant - vendu par momo",
    montant: 12, client: "Passant", vendeur: "momo", part_vendeur: 5, part_hotel: 7 },
];
r = tirer({ ventes: AVEC_TAUX, journal: grilleVide(10, 12) });
const g = r.grille;
verifier(g[0].slice(9, 12).join("|") === "Cout|Benefice|Commission hotel",
  "en-têtes J à L", g[0].join(" | "));
verifier(g[1][9] === 44.66 && g[1][11] === 0.2,
  "coût en J, taux en L (0,2 affiché 20 %)", g[1].join(" | "));
verifier(r.formulesA1.H2 === "=MAX(0,ROUND(K2*(1-L2),2))"
  && r.formulesA1.I2 === "=D2-H2" && r.formulesA1.K2 === "=D2-J2",
  "part vendeur, part hôtel et bénéfice en formules", JSON.stringify(r.formulesA1));
verifier(r.formulesA1.J2 === undefined, "le coût reste une valeur, pas une formule", "");
// Ce que la formule donnera dans Sheets, refait ici : elle doit retomber
// sur la prime que l'appli a créditée au vendeur.
const prime = Math.max(0, Math.round((g[1][3] - g[1][9]) * (1 - g[1][11]) * 100) / 100);
verifier(prime === 44.27, "la formule retrouve la prime de l'appli (44,27)", prime);
verifier(g[2][7] === 5 && g[2][8] === 7 && g[2][9] === "" && g[2][11] === ""
  && r.formulesA1.H3 === undefined,
  "vente sans coût ni taux : parts en valeurs, J à L vides", g[2].join(" | "));

// Onglet du 21/09 (en-têtes jusqu'à I) : J à L s'ajoutent, le reste ne bouge pas.
const du21 = grilleVide(10, 12);
du21[0] = ["Id", "Date", "Description", "Montant", "Montant total cumule",
  "Client", "Vendeur", "Part vendeur", "Part hotel", "", "", ""];
du21[1] = [1, new Date(2026, 8, 21, 12), "vieille vente", 40, 40, "Bob", "momo", 16.67, 23.33, "", "", ""];
r = tirer({ ventes: AVEC_TAUX, journal: du21 });
verifier(r.grille[0].slice(5, 12).join("|") === "Client|Vendeur|Part vendeur|Part hotel|Cout|Benefice|Commission hotel",
  "onglet du 21/09 : J à L ajoutées, F à I intactes", r.grille[0].join(" | "));
verifier(r.grille[1][7] === 16.67 && r.grille[1][9] === "",
  "vieille vente jamais touchée", r.grille[1].join(" | "));
verifier(r.formulesA1.H3 === "=MAX(0,ROUND(K3*(1-L3),2))",
  "nouvelle vente en bas, formules sur sa propre ligne", JSON.stringify(r.formulesA1));

// 4. Rien à écrire : aucun accusé inutile.
r = tirer({ ventes: [] });
verifier(r.ecrites === 0 && r.appels.length === 1,
  "aucune vente : un seul appel, pas d'accusé", JSON.stringify(r.appels));

// 5. Onglet absent du classeur : le tirage se tait, l'envoi des prix continue.
const sansOnglet = fauxContexte({}, () => ({ code: 200, corps: "{}" }));
vm.createContext(sansOnglet.ctx);
vm.runInContext(fs.readFileSync(path.join(SCRIPT, "JournalSnack.js"), "utf8"), sansOnglet.ctx,
  { filename: "JournalSnack.js" });
verifier(vm.runInContext("tirerVentesSnack_('secret-de-test')", sansOnglet.ctx) === 0
  && sansOnglet.appels.length === 0,
  "onglet Journal Snack absent : rien n'est demandé, rien ne casse", "");

console.log(echecs === 0 ? "\nTout passe.\n" : `\n${echecs} échec(s).\n`);
process.exit(echecs === 0 ? 0 : 1);
