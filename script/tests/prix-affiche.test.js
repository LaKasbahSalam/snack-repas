/**
 * Menu « Aligner les prix sur l'affiche » (PrixAffiche.js) : ce qu'il
 * propose, ce qu'il écrit, et qu'il n'écrit rien sans accord.
 *
 *   node tests/prix-affiche.test.js
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

/** Un classeur comme celui en ligne le 26/11/2026, en plus petit. */
function classeur() {
  const items = grilleVide(14, 12);
  [["", "Pain panini", 4, 17.5, 4.375], ["", "kefta", 1, 2.45, 2.45]]
    .forEach((l, i) => l.forEach((v, j) => { items[2 + i][j] = v; }));
  ["Frites", "Frites et nuggets", " Burger", "PaniniKefta", "P.Chameau", "Tajine chameau"]
    .forEach((n, j) => { items[1][5 + j] = n; });
  items[6][4] = "Produit";
  items[7][4] = "Coût revient";
  [6, 16.29, 20, 20.02, 33.29, 19.92].forEach((v, j) => { items[7][5 + j] = v; });
  items[8][4] = "Prix de vente";
  [20, 35, 40, 40, 50, 40].forEach((v, j) => { items[8][5 + j] = v; });

  const boissons = grilleVide(6, 8);
  boissons[0] = ["Boisson", "Prix d'achat", "Prix de vente", "Marge (DH)", "Coût / prix", "Code équipe", "Prix équipe", "Part vendeur"];
  boissons[1] = ["Jus d'orange", 4, 10, 6, 0.4, "", "", 0.8];
  boissons[2] = ["Coca ", 4.5, 10, 5.5, 0.45, "coca", 5, 0.8];
  boissons[3] = ["Bière", 17, 35, 18, 0.49, "", "", 0];
  return { items: new FausseFeuille(items), boissons: new FausseFeuille(boissons) };
}

/** Lance le menu avec des réponses toutes prêtes aux fenêtres Oui / Non. */
function lancer(feuilles, reponses) {
  const fenetres = [];
  const { ctx } = fauxContexte({ "Items & Sandwichs": feuilles.items, "Boissons": feuilles.boissons },
    () => ({ code: 200, corps: "{}" }));
  ctx.envoisDemandes = 0;
  ctx.SpreadsheetApp.getUi = () => ({
    ButtonSet: { OK: "OK", YES_NO: "YES_NO" },
    Button: { YES: "OUI", NO: "NON" },
    alert: (titre, message, boutons) => {
      // alert(message) seul : le texte arrive en premier argument.
      fenetres.push({ titre, message: message === undefined ? titre : message, boutons });
      return boutons === "YES_NO" ? reponses.shift() : "OK";
    },
  });
  vm.createContext(ctx);
  for (const f of ["Snack.js", "Carte.js", "Boissons.js", "CarteAppli.js", "PrixAffiche.js"]) {
    vm.runInContext(fs.readFileSync(path.join(SCRIPT, f), "utf8"), ctx, { filename: f });
  }
  // L'envoi à l'appli a ses propres tests : ici on compte seulement s'il est demandé.
  vm.runInContext("envoyerPrixAppli = () => { envoisDemandes++; }", ctx);
  vm.runInContext("alignerPrixAffiche()", ctx);
  return { fenetres, envois: ctx.envoisDemandes };
}

const prixItems = (f) => f.items.g[8].slice(5, 11);

console.log("1. Refus : la liste est montrée, rien n'est écrit");
{
  const f = classeur();
  const { fenetres, envois } = lancer(f, ["NON"]);
  const m = fenetres[0].message;
  verifier(/5 prix à changer/.test(m), "cinq changements annoncés", m);
  verifier(m.includes("Frites et nuggets : 35 -> 30"), "frites & nuggets 35 -> 30", m);
  verifier(m.includes("PaniniKefta : 40 -> 35"), "panini kefta 40 -> 35", m);
  verifier(m.includes("Tajine chameau : 40 -> 45"), "tajine chameau 40 -> 45", m);
  verifier(m.includes("Jus d'orange : 10 -> 15"), "jus d'orange 10 -> 15", m);
  verifier(/P\.Chameau : 50 -> 35 DH +ATTENTION/.test(m), "panini chameau signalé : marge sous 5 DH", m);
  verifier(!/PaniniKefta[^\n]*ATTENTION/.test(m), "panini kefta non signalé (marge 15 DH)", m);
  verifier(m.includes("Burger") && m.includes("Bière") && /Pas sur l'affiche/.test(m), "burger et bière : hors affiche, laissés", m);
  verifier(/introuvable[^\n]*Sandwich zaalouk/.test(m), "sandwich zaalouk absente de la fiche : à créer", m);
  verifier(m.includes("P.NugDinde") && /introuvable/.test(m), "produit de l'affiche absent de la fiche signalé", m);
  verifier(JSON.stringify(prixItems(f)) === "[20,35,40,40,50,40]", "Items & Sandwichs intact", prixItems(f));
  verifier(f.boissons.g[1][2] === 10, "Boissons intact", f.boissons.g[1][2]);
  verifier(envois === 0, "pas d'envoi à l'appli", envois);
}

console.log("2. Accord sans envoi : les prix sont écrits, eux seuls");
{
  const f = classeur();
  const { envois } = lancer(f, ["OUI", "NON"]);
  verifier(JSON.stringify(prixItems(f)) === "[20,30,40,35,35,45]", "prix de vente des plats alignés, burger inchangé", prixItems(f));
  verifier(f.boissons.g[1][2] === 15, "jus d'orange à 15", f.boissons.g[1][2]);
  verifier(f.boissons.g[2][2] === 10 && f.boissons.g[3][2] === 35, "coca et bière inchangés", [f.boissons.g[2][2], f.boissons.g[3][2]]);
  verifier(f.items.g[7][8] === 20.02 && f.boissons.g[1][1] === 4, "coûts et prix d'achat intacts", [f.items.g[7][8], f.boissons.g[1][1]]);
  verifier(envois === 0, "pas d'envoi à l'appli", envois);
}

console.log("3. Accord avec envoi, puis second passage : plus rien à changer");
{
  const f = classeur();
  const premier = lancer(f, ["OUI", "OUI"]);
  verifier(premier.envois === 1, "envoi à l'appli demandé une fois", premier.envois);
  const second = lancer(f, []);
  verifier(/déjà ceux de l'affiche/.test(second.fenetres[0].message), "second passage : déjà aligné", second.fenetres[0].message);
  verifier(second.fenetres.length === 1, "une seule fenêtre, aucune question", second.fenetres.length);
}

console.log("3b. Omelette créée au forfait, prix encore vide : proposée à 30");
{
  const f = classeur();
  f.items.g[1][11] = "Sandwich zaalouk";
  f.items.g[7][11] = 8;
  const { fenetres } = lancer(f, ["OUI", "NON"]);
  verifier(fenetres[0].message.includes("Sandwich zaalouk : vide -> 30 DH"), "prix vide -> 30", fenetres[0].message);
  verifier(f.items.g[8][11] === 30, "30 écrit sous l'omelette", f.items.g[8][11]);
}

console.log("4. Ligne « Prix de vente » absente : erreur, rien d'écrit");
{
  const f = classeur();
  f.items.g[8][4] = "Prix";
  const { fenetres } = lancer(f, ["OUI"]);
  verifier(/Prix de vente.*introuvable/.test(fenetres[0].message), "erreur claire", fenetres[0].message);
  verifier(f.boissons.g[1][2] === 10, "boissons intactes", f.boissons.g[1][2]);
}

console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
