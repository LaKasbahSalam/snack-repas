/**
 * Ce que `lireCarte_()` envoie réellement à l'appli.
 *
 *   node tests/carte.test.js
 *
 * L'enjeu : la prime du vendeur se calcule dans l'appli à partir du prix de
 * revient et de la retenue que CE script envoie. S'ils manquent, la prime
 * tombe à zéro sans que rien ne le signale. Ce test fait tourner le script
 * sur une fausse feuille et vérifie ce qui part.
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

// « Cout par item » : ingrédients lignes 3 à 5, produits en F..H, et sous
// les ingrédients le bloc « Coût revient » / « Prix de vente ».
const coutParItem = grilleVide(12, 10);
[["", "kefta", "", "", 2.45], ["", "pain panini", "", "", 3.38], ["", "coca", "", "", 6]]
  .forEach((l, i) => l.forEach((v, j) => { coutParItem[2 + i][j] = v; }));
coutParItem[1][5] = "PaniniKefta";
coutParItem[1][6] = "Burger";
coutParItem[1][7] = "Menu (+frites)";
coutParItem[5][4] = "Produit";
coutParItem[6][4] = "Coût revient"; coutParItem[6][5] = 18.33; coutParItem[6][6] = 21.5; coutParItem[6][7] = 4;
coutParItem[7][4] = "Prix de vente"; coutParItem[7][5] = 40; coutParItem[7][6] = 45; coutParItem[7][7] = 10;

// « Boissons » : nom, prix d'achat, prix de vente.
const boissons = grilleVide(4, 5);
boissons[0] = ["Boisson", "Prix d'achat", "Prix de vente", "", ""];
boissons[1] = ["Coca / Hawai", 6, 12, "", ""];
boissons[2] = ["Théière", 3, 15, "", ""];

// « Carte appli » SANS colonne Retenue : une carte d'avant la prime, que le
// script doit compléter tout seul.
const carte = grilleVide(6, 7);
carte[0] = ["Rubrique", "Article", "Produit de la fiche", "Sauce", "Frites", "Code", "Prix envoyé"];
carte[1] = ["Paninis", "Panini kefta", "PaniniKefta", true, true, "panini_kefta", ""];
carte[2] = ["Boissons", "Coca / Hawai", "Coca / Hawai", false, false, "coca", ""];
carte[3] = ["Burgers", "Burger bœuf", "Burger", true, true, "burger", ""];
carte[4] = ["Supplément", "Avec frites (menu)", "Menu (+frites)", false, false, "menu_frites", ""];

const feuilleCarte = new FausseFeuille(carte);
const { ctx } = fauxContexte({
  "Cout par item": new FausseFeuille(coutParItem),
  "Boissons": new FausseFeuille(boissons),
  "Carte appli": feuilleCarte,
}, () => ({ code: 200, corps: "{}" }));

vm.createContext(ctx);
for (const f of ["Snack.js", "Carte.js", "Boissons.js", "CarteAppli.js"]) {
  vm.runInContext(fs.readFileSync(path.join(SCRIPT, f), "utf8"), ctx, { filename: f });
}
const envoyee = vm.runInContext("lireCarte_()", ctx).map(({ ligne, ...a }) => a);
const par = (code) => envoyee.find((a) => a.code === code);

verifier(envoyee.length === 4, "4 articles lus", envoyee.length);
verifier(par("panini_kefta").prix_vente === 40 && par("panini_kefta").cout === 18.33,
  "panini : prix de vente et coût de revient de la fiche",
  JSON.stringify([par("panini_kefta").prix_vente, par("panini_kefta").cout]));
verifier(par("coca").prix_vente === 12 && par("coca").cout === 6,
  "boisson : prix de vente et prix d'achat de l'onglet Boissons",
  JSON.stringify([par("coca").prix_vente, par("coca").cout]));
verifier(par("menu_frites").cout === 4, "supplément frites : son coût part aussi", par("menu_frites").cout);
verifier(par("panini_kefta").retenue === 5, "retenue par défaut : 5 DH", par("panini_kefta").retenue);
verifier(par("coca").retenue === 1, "rubrique Boissons : retenue de 1 DH", par("coca").retenue);
verifier(par("panini_kefta").sauce === true && par("panini_kefta").frites === true,
  "options sauce et frites transmises", "");
verifier(carte[0][7] === "Retenue",
  "la colonne Retenue est créée si elle manque", carte[0][7]);
verifier(carte[1][7] === 5 && carte[2][7] === 1,
  "et pré-remplie : 5 DH, 1 DH sur les boissons", JSON.stringify([carte[1][7], carte[2][7]]));

// Une retenue écrite à la main est respectée, une valeur absurde refusée.
carte[1][7] = 0;
const relue = vm.runInContext("lireCarte_()", ctx).find((a) => a.code === "panini_kefta");
verifier(relue.retenue === 0, "retenue à 0 saisie à la main : respectée", relue.retenue);
carte[1][7] = -3;
let refuse = false;
try { vm.runInContext("lireCarte_()", ctx); } catch { refuse = true; }
verifier(refuse, "retenue négative : l'envoi est refusé, rien ne part", "acceptée");

console.log(echecs === 0 ? "\nTout passe.\n" : `\n${echecs} échec(s).\n`);
process.exit(echecs === 0 ? 0 : 1);
