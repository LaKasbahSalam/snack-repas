/**
 * Ce que `construireRepasMois()` écrit dans « Repas / Mois » : un bloc par
 * mois, une ligne par plat, des formules qui cherchent dans « Journal Repas ».
 *
 *   node tests/repas-mois.test.js
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

class Feuille extends FausseFeuille {
  getIndex() { return 1; }
  getRange(...a) {
    const api = super.getRange(...a);
    return Object.assign(api, { setFontSize: () => api, setFontStyle: () => api });
  }
}

// « Journal Repas » comme en ligne le 12/10/2026 (deux « tajine » de casse différente).
const d = (j, m) => new Date(2026, m - 1, j);
const journal = grilleVide(20, 11);
journal[0] = ["ID", "Date", "Description", "Depenses", "Depenses Extras", "Produits", "Organisation", "Revenu net", "Nbre de Personne", "Paiement par personne", "Qui encaisse"];
[
  [d(11, 9), "Couscous", 260, "", 360, "Ayoub Saida", "", 6, 60],
  [d(13, 9), "Barbecue", 240, 80, 420, "Ayoub", "", 7, 75],
  [d(16, 8), "tajine", 100, "", 240, "Ayoub", "", 4, 60],
  [d(30, 8), "Tajine", 200, "", 300, "Ayoub", "", 5, 60],
  [d(2, 10), "Couscous", 290, "", 375, "", "", 5, 75],
  [d(4, 10), "Kefta", 60, "", 0, "", "", 0, 100],
  [d(6, 10), "Tajine", 250, 40, 240, "", "", 4, 60],
  [d(9, 10), "Couscous", 250, 15, 725, "", "", 10, 75],
].forEach((l, i) => l.forEach((v, j) => { journal[1 + i][1 + j] = v; }));
journal[12][7] = "=F13-SUM(D13;E13)"; // ligne vide avec sa formule : ignorée

const fJournal = new Feuille(journal);
const mois = new Feuille(grilleVide(10, 10));
const feuilles = { "Journal Repas": fJournal, "Repas / Mois": mois };
const { ctx } = fauxContexte(feuilles, () => ({ code: 200, corps: "{}" }));
let alerte = "";
ctx.SpreadsheetApp.getActive = () => ({ getSheetByName: (n) => feuilles[n] ?? null, insertSheet: () => null });
ctx.SpreadsheetApp.getUi = () => ({ alert: (t) => { alerte = t; } });
vm.createContext(ctx);
for (const f of ["Snack.js", "RepasMois.js"]) {
  vm.runInContext(fs.readFileSync(path.join(SCRIPT, f), "utf8"), ctx, { filename: f });
}
vm.runInContext("construireRepasMois()", ctx);

const g = mois.g;
const colA = g.map((l) => (Object.prototype.toString.call(l[0]) === "[object Date]" ? `${l[0].getMonth() + 1}/${l[0].getFullYear()}` : String(l[0])));

// 1. Les mois, du plus récent au plus ancien, et leurs plats.
const titres = g.map((l, i) => (Object.prototype.toString.call(l[0]) === "[object Date]" ? i + 1 : 0)).filter(Boolean);
verifier(titres.length === 3 && colA[titres[0] - 1] === "10/2026" && colA[titres[2] - 1] === "8/2026",
  "trois mois, octobre en haut, août en bas", colA.join(" | "));
const platsDe = (t) => { const r = []; for (let i = t + 1; g[i][0] !== "Total"; i++) r.push(g[i][0]); return r; };
verifier(platsDe(titres[0]).join(",") === "Couscous,Kefta,Tajine", "octobre : Couscous, Kefta, Tajine", platsDe(titres[0]));
verifier(platsDe(titres[2]).join(",") === "Tajine", "août : « tajine » et « Tajine » sur une seule ligne", platsDe(titres[2]));
verifier(g[titres[0]].join("|").startsWith("Plat|Repas|Personnes|Recette"), "en-têtes sous le titre", g[titres[0]].join(" | "));

// 2. Les chiffres : des formules qui cherchent dans le journal par date et par plat.
const t = titres[0];
const ligne = g[t + 1]; // Couscous d'octobre
verifier(ligne.slice(1, 8).every((v) => String(v).startsWith("=")), "colonnes B à H : des formules", ligne.join(" | "));
verifier(ligne[1].includes("COUNTIFS('Journal Repas'!$B:$B;\">=\"&$A$" + t) && ligne[1].includes("EDATE($A$" + t + ";1)") && ligne[1].includes("'Journal Repas'!$C:$C;$A" + (t + 2)),
  "repas : comptés entre le 1er du mois et le 1er du suivant, par nom", ligne[1]);
verifier(ligne[2].startsWith("=SUMIFS('Journal Repas'!$I:$I") && ligne[3].startsWith("=SUMIFS('Journal Repas'!$F:$F"),
  "personnes en I, recette en F (retrouvées par l'en-tête)", `${ligne[2]} / ${ligne[3]}`);
verifier(ligne[4].includes("$D:$D") && ligne[4].includes("$E:$E"), "dépenses : D + dépenses extras E", ligne[4]);
const tot = t + 5; // ligne du Total d'octobre : titre, en-têtes, 3 plats
verifier(g[tot - 1][0] === "Total" && g[tot - 1][1] === `=SUM(B${t + 2}:B${t + 4})`, "ligne Total", g[tot - 1].join(" | "));
const bilan = g[tot][0];
verifier(bilan.startsWith('="Bilan : "') && bilan.includes("le plus rentable") && bilan.includes("à perte"), "phrase de bilan", bilan);

// 3. Feuille en français : aucune virgule dans les formules.
const formules = g.flat().filter((v) => String(v).startsWith("="));
verifier(formules.every((x) => !x.includes(",")), "séparateur « ; » partout", formules.find((x) => x.includes(",")));
verifier(g[1][0].includes("COUNT('Journal Repas'!$B:$B)") && g[1][0].includes("relancer"), "ligne 2 : repas non comptés signalés", g[1][0]);
verifier(alerte.includes("3 mois"), "message de fin", alerte);

// 4. Relancer : réécrit, pas doublé.
vm.runInContext("construireRepasMois()", ctx);
verifier(g.filter((l) => l[0] === "Total").length === 3, "relancé : trois blocs, pas six", g.filter((l) => l[0] === "Total").length);

// 5. Jamais par-dessus un onglet rempli à la main.
const autre = new Feuille(grilleVide(5, 5));
autre.g[0][0] = "Mes notes";
feuilles["Repas / Mois"] = autre;
let refus = "";
try { vm.runInContext("construireRepasMois()", ctx); } catch (e) { refus = e.message; }
verifier(refus.includes("Renommez") && autre.g[0][0] === "Mes notes", "onglet étranger : refusé, rien effacé", refus);

console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
