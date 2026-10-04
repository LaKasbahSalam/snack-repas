/**
 * Ce que `mettreEnForme()` fait du classeur : lignes inutiles retirées sous
 * le bloc, et l'onglet « Plats » où chaque case cherche le plat par son nom.
 *
 *   node tests/mise-en-forme.test.js
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

// Ce que mettreAJour() et mettreEnForme() appellent en plus des valeurs :
// mise en forme acceptée et ignorée, suppression de ligne réelle.
class Feuille extends FausseFeuille {
  constructor(g) { super(g); this.regles = []; this.filtre = null; this.supprimees = []; }
  deleteRow(r) { this.g.splice(r - 1, 1); this.g.push(Array(this.g[0].length).fill("")); this.supprimees.push(r); return this; }
  setFrozenColumns() { return this; }
  setConditionalFormatRules(r) { this.regles = r; return this; }
  getFilter() { return this.filtre; }
  getRange(...a) {
    const api = super.getRange(...a);
    const feuille = this;
    return Object.assign(api, {
      setWrap: () => api, clear: () => api.clearContent(),
      getFormulas: () => api.getValues().map((l) => l.map((v) => (String(v).startsWith("=") ? v : ""))),
      createFilter: () => { feuille.filtre = { remove: () => { feuille.filtre = null; } }; return feuille.filtre; },
    });
  }
}

// « Items & Sandwichs » comme en ligne : ingrédients 3 à 5, trois produits,
// puis le bloc avec les lignes ajoutées à la main.
const items = grilleVide(30, 12);
items[1] = ["conservation", "Description", "Qte achete", "Prix", "Prix/unite", "PaniniKefta", "Frites", "Sandwich", "", "", "", ""];
[["", "pain panini", 4, 17.5, "", 1, 0, 0], ["", "kefta", 49, 120, "", 5, 0, 0], ["", "frites", 6, 30, "", 0, 1, 0]]
  .forEach((l, i) => l.forEach((v, j) => { items[2 + i][j] = v; }));
const bloc = [
  ["Produit"], ["Coût revient"], ["Objectif cout de Revient", "=F9/3"], ["Prix de vente", 30, 20, 35],
  ["Marge (DH)"], ["Coût / prix"], ["Revenu", "=F11-F9", "=G11-G9", "=H11-H9"],
  ["Benefice"], ["Part Vendeur"], ["Part Hotel", "", 5], ["Objectif coût", 0.35], ["Prix conseillé"], ["Part vendeur", 0.8, 0.8, 0.8],
];
bloc.forEach((l, i) => l.forEach((v, j) => { items[7 + i][4 + j] = v; }));

const boissons = grilleVide(4, 8);
boissons[0] = ["Boisson", "Prix d'achat", "Prix de vente", "Marge (DH)", "Coût / prix", "Code équipe", "Prix équipe", "Part vendeur"];
boissons[1] = ["Jus d'orange", 4, 15, "", "", "", "", 0.8];
boissons[2] = ["Bière", 17, 35, "", "", "", "", 0];

const carte = grilleVide(3, 10);
carte[0] = ["Rubrique", "Article", "Produit de la fiche", "Sauce", "Frites", "Code"];
carte[1] = ["Paninis", "Panini kefta", "PaniniKefta", true, true, "panini_kefta"];

const fItems = new Feuille(items);
const plats = new Feuille(grilleVide(3, 10));
const feuilles = { "Items & Sandwichs": fItems, "Boissons": new Feuille(boissons), "Carte appli": new Feuille(carte) };
const { ctx } = fauxContexte(feuilles, () => ({ code: 200, corps: "{}" }));
let alerte = "";
ctx.SpreadsheetApp.getActive = () => ({
  getSheetByName: (n) => feuilles[n] ?? null,
  insertSheet: (n) => { feuilles[n] = plats; return plats; },
});
ctx.SpreadsheetApp.getUi = () => ({ alert: (t) => { alerte = t; } });
const regle = () => {
  const r = { formule: "" };
  const b = { whenFormulaSatisfied: (f) => { r.formule = f; return b; }, build: () => r };
  for (const m of ["setBackground", "setBold", "setFontColor", "setRanges"]) b[m] = () => b;
  return b;
};
ctx.SpreadsheetApp.newConditionalFormatRule = regle;
let memo = null;
ctx.PropertiesService.getDocumentProperties = () => ({ getProperty: () => memo, setProperty: (_k, v) => { memo = v; } });
vm.createContext(ctx);
for (const f of ["Snack.js", "Carte.js", "Boissons.js", "CarteAppli.js", "PartVendeur.js", "JournalSnack.js", "Envoi.js", "MiseEnForme.js"]) {
  vm.runInContext(fs.readFileSync(path.join(SCRIPT, f), "utf8"), ctx, { filename: f });
}
vm.runInContext("mettreEnForme()", ctx);

// 1. Lignes retirées : Revenu (en double), Benefice et Part Vendeur (vides).
const libelles = items.map((l) => l[4]);
verifier(!libelles.includes("Revenu"), "« Revenu » retirée", libelles.join(" | "));
verifier(!libelles.includes("Benefice") && !libelles.includes("Part Vendeur"), "« Benefice » et « Part Vendeur » vides retirées", libelles.join(" | "));
verifier(libelles.includes("Part Hotel"), "« Part Hotel » remplie à la main : gardée", libelles.join(" | "));
verifier(libelles.includes("Part vendeur") && libelles.includes("Objectif cout de Revient"), "« Part vendeur » et l'objectif ajouté à la main : gardés", libelles.join(" | "));
verifier(items[1][5] === "PaniniKefta" && items[3][1] === "kefta", "noms en ligne 2 et ingrédients inchangés", items[1].join(" | "));
verifier(fItems.regles.length === 5, "règles de la grille ajoutées à celles de mettreAJour()", fItems.regles.length);

// 2. « Plats » : une ligne par produit puis par boisson.
const pg = plats.g;
verifier(pg[0][0] === "Plat" && pg[0][9] === "Pour le vendeur (DH)", "en-têtes de « Plats »", pg[0].join(" | "));
verifier(["PaniniKefta", "Frites", "Sandwich", "Jus d'orange", "Bière"].every((n, i) => pg[1 + i][0] === n),
  "produits de la fiche, puis boissons", pg.map((l) => l[0]).join(" | "));
const f2 = pg[1].slice(1);
verifier(f2.every((x) => x.startsWith("=")), "colonnes B à J : des formules", f2.join(" | "));
const lCout = items.findIndex((l) => l[4] === "Coût revient") + 1;
const lPart = items.findIndex((l) => l[4] === "Part vendeur") + 1;
verifier(f2[2].includes(`$${lCout}:$${lCout}`) && f2[2].includes("MATCH($A2"), "coût cherché par le nom, sur la ligne « Coût revient » d'après le ménage", f2[2]);
verifier(f2[7].includes(`$${lPart}:$${lPart}`) && f2[7].includes("Boissons!$H:$H"), "part vendeur : fiche, sinon Boissons", f2[7]);
verifier(pg[5][3].replace(/5/g, "") === f2[2].replace(/A2/g, "A6").replace(/5/g, ""), "la même formule sur chaque ligne (seul le numéro change)", pg[5][3]);
verifier(f2[1].includes('" × "') && f2[1].includes("CHAR(10)"), "ingrédients en clair, un par ligne", f2[1]);
verifier(plats.filtre !== null, "filtre posé : tri et tri inversé par colonne", plats.filtre);
verifier(alerte.includes("Revenu"), "message de fin : lignes retirées", alerte);

// 3. Relancer : l'onglet est réécrit, pas doublé.
vm.runInContext("mettreEnForme()", ctx);
verifier(pg[1][0] === "PaniniKefta" && pg.length === 6 && pg.filter((l) => l[0] === "PaniniKefta").length === 1, "relancé : mêmes lignes, rien en trop", pg.map((l) => l[0]).join(" | "));

console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
