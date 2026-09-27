/**
 * Ce que `preparerPartsVendeur_()` pose dans le classeur : la part du
 * vendeur réglable par article, et les renvois de « Carte appli » que lit
 * le Journal Snack.
 *
 *   node tests/parts.test.js
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

// « Items & Sandwichs » : ingrédients lignes 3 à 5, produits en F..H, et
// sous les ingrédients le bloc « Coût revient » / « Prix de vente ».
const items = grilleVide(12, 10);
[["", "kefta", "", "", 2.45], ["", "pain panini", "", "", 3.38], ["", "coca", "", "", 6]]
  .forEach((l, i) => l.forEach((v, j) => { items[2 + i][j] = v; }));
items[1][5] = "PaniniKefta";
items[1][6] = "Burger";
items[1][7] = "Menu (+frites)";
items[5][4] = "Produit";
items[6][4] = "Coût revient"; items[6][5] = 18.33; items[6][6] = 21.5; items[6][7] = 4;
items[7][4] = "Prix de vente"; items[7][5] = 40; items[7][6] = 45; items[7][7] = 10;

// « Boissons » : nom, prix d'achat, prix de vente, et une colonne « Prix équipe ».
const boissons = grilleVide(5, 8);
boissons[0] = ["Boisson", "Prix d'achat", "Prix de vente", "Marge (DH)", "Coût / prix", "Code équipe", "Prix équipe", ""];
boissons[1] = ["Coca / Hawai", 6, 12, "", "", "coca", 6, ""];
boissons[2] = ["Bière", 16, 35, "", "", "", "", ""];
boissons[3] = ["Bière sans alcool", 12, 25, "", "", "", "", ""];

// « Carte appli » : A à G, et H « Retenue » laissée d'avant.
const carte = grilleVide(8, 12);
carte[0] = ["Rubrique", "Article", "Produit de la fiche", "Sauce", "Frites", "Code", "Prix envoyé", "Retenue"];
carte[1] = ["Paninis", "Panini kefta", "PaniniKefta", true, true, "panini_kefta", 40, 5];
carte[2] = ["Boissons", "Coca / Hawai", "Coca / Hawai", false, false, "coca", 12, 1];
carte[3] = ["Boissons", "Bière", "Bière", false, false, "biere", 35, 35];
carte[4] = ["Plats", "Tajine", "Tajine kefta", false, false, "tajine_kefta", 60, 5];
carte[5] = ["Supplément", "Avec frites (menu)", "Menu (+frites)", false, false, "menu_frites", 10, 5];

const fItems = new FausseFeuille(items);
const fBoissons = new FausseFeuille(boissons);
const fCarte = new FausseFeuille(carte);
const { ctx } = fauxContexte({
  "Items & Sandwichs": fItems, "Boissons": fBoissons, "Carte appli": fCarte,
}, () => ({ code: 200, corps: "{}" }));
vm.createContext(ctx);
for (const f of ["Snack.js", "Carte.js", "Boissons.js", "CarteAppli.js", "PartVendeur.js", "JournalSnack.js", "Envoi.js"]) {
  vm.runInContext(fs.readFileSync(path.join(SCRIPT, f), "utf8"), ctx, { filename: f });
}
vm.runInContext("preparerPartsVendeur_()", ctx);

// 1. « Items & Sandwichs » : la ligne « Part vendeur », sous tout le reste.
const lPart = items.findIndex((l) => l[4] === "Part vendeur") + 1;
verifier(lPart === 10, "ligne « Part vendeur » posée en E10, une ligne sous le bloc", lPart);
verifier(items[lPart - 1].slice(5, 8).every((v) => v === 0.8), "80 % sous chaque produit au départ", items[lPart - 1].join(" | "));

// 2. « Boissons » : la colonne « Part vendeur », bières à 0 %.
verifier(boissons[0][7] === "Part vendeur", "colonne « Part vendeur » en H de Boissons", boissons[0].join(" | "));
verifier(boissons[1][7] === 0.8 && boissons[2][7] === 0 && boissons[3][7] === 0,
  "coca 80 %, bière et bière sans alcool 0 %", boissons.map((l) => l[7]).join(" | "));

// 3. « Carte appli » : des renvois vers la case du produit.
verifier(carte[0][8] === "Coût revient" && carte[0][9] === "Part vendeur",
  "colonnes I « Coût revient » et J « Part vendeur », après la Retenue", carte[0].join(" | "));
const f = fCarte.formulesA1;
verifier(f.I2 === "='Items & Sandwichs'!F7" && f.J2 === "='Items & Sandwichs'!F10",
  "panini : coût et part renvoient à sa colonne de « Items & Sandwichs »", `${f.I2} ${f.J2}`);
verifier(f.I3 === "='Boissons'!B2" && f.J3 === "='Boissons'!H2" && f.I4 === "='Boissons'!B3" && f.J4 === "='Boissons'!H3",
  "coca et bière : renvoient à leur ligne de « Boissons »", `${f.I3} ${f.J3} ${f.I4} ${f.J4}`);
verifier(f.I5 === "" && f.J5 === "", "tajine absent des fiches : rien, pas un faux renvoi", `${f.I5}|${f.J5}`);
verifier(f.I6 === "='Items & Sandwichs'!H7", "supplément frites : renvoi à son coût", f.I6);
verifier(Object.values(f).every((x) => !/[,;]/.test(x)), "aucun séparateur de langue dans les renvois", JSON.stringify(f));

// 4. Deuxième passage après vos réglages : rien n'est écrasé.
items[lPart - 1][5] = 0.5;
boissons[2][7] = 0.1;
vm.runInContext("preparerPartsVendeur_()", ctx);
verifier(items[lPart - 1][5] === 0.5 && items.filter((l) => l[4] === "Part vendeur").length === 1,
  "part du panini réglée à 50 % : gardée, pas de seconde ligne", items[lPart - 1].join(" | "));
verifier(boissons[2][7] === 0.1 && boissons[0].filter((e) => e === "Part vendeur").length === 1,
  "part de la bière réglée à 10 % : gardée, pas de seconde colonne", boissons[0].join(" | "));
verifier(carte[0].filter((e) => e === "Part vendeur").length === 1 && fCarte.formulesA1.J2 === "='Items & Sandwichs'!F10",
  "carte : mêmes colonnes, renvois refaits", carte[0].join(" | "));

console.log(echecs === 0 ? "\nTout passe.\n" : `\n${echecs} échec(s).\n`);
process.exit(echecs === 0 ? 0 : 1);
