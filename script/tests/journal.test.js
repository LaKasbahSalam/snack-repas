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
  { id: 2, date_vente: "2026-09-20", description: "Panini kefta + frites (ketchup) x 2 - Alice - vendu par momo", montant: 100 },
  { id: 3, date_vente: "2026-09-20", description: "Coca / Hawai x 3 - Passant - vendu par momo", montant: 36 },
];

/** Fait tourner un tirage et rend ce qui s'est passé. */
function tirer({ ventes = VENTES, journal = grilleVide(10, 6), accuseEchoue = false } = {}) {
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
  return { ecrites, grille: feuille.g, formules: feuille.formules, appels };
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

// 2. Une vente déjà dans l'onglet : pas de doublon même si un accusé s'est perdu.
const dejaLa = grilleVide(10, 6);
dejaLa[0] = ["Id", "Date", "Description", "Montant", "Montant total cumule", ""];
dejaLa[1] = [2, new Date(2026, 8, 20, 12), "déjà écrite à la main", 100, 100, ""];
r = tirer({ journal: dejaLa });
verifier(r.ecrites === 1, "vente déjà présente non réécrite, la nouvelle oui", r.ecrites);
verifier(r.grille[2][0] === 3, "la nouvelle s'ajoute en bas", r.grille[2].join(" | "));
verifier(r.formules[3] === "=N(E2)+D3", "le cumul reprend la ligne du dessus", JSON.stringify(r.formules));

// 3. L'accusé échoue : les lignes restent écrites, rien n'est perdu.
r = tirer({ accuseEchoue: true });
verifier(r.grille[1][0] === 2 && r.grille[2][0] === 3,
  "accusé en panne : les lignes sont quand même dans l'onglet", "lignes manquantes");
verifier(r.ecrites === 0,
  "accusé en panne : annoncé comme 0 écrite, les ventes repartiront au prochain passage", r.ecrites);

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
