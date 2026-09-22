/**
 * Ce que `envoyerPrix_()` envoie pour les boissons.
 *
 *   node tests/envoi.test.js
 *
 * L'enjeu : l'équipe paie la boisson 6 DH, et non son prix d'achat. Le prix
 * part de la colonne « Prix équipe » de l'onglet Boissons. Et une boisson
 * mal renseignée ne doit pas seulement rater son envoi : elle ferait échouer
 * tout l'envoi du soir, ingrédients et carte compris. Ces cas-là comptent
 * donc autant que le cas normal.
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

/** « Cout par item » : deux ingrédients, dont un seul a un code équipe. */
function coutParItem() {
  const g = grilleVide(10, 10);
  g[1][5] = "PaniniKefta";
  g[1][9] = "Code équipe"; // colonne J, une colonne après les produits
  g[2] = ["", "kefta", "", "", 2.45, 1, "", "", "", "kefta"];
  g[3] = ["", "sauce", "", "", 1, 1, "", "", "", ""];
  g[5][4] = "Produit";
  g[6][4] = "Coût revient"; g[6][5] = 3.45;
  g[7][4] = "Prix de vente"; g[7][5] = 40;
  return g;
}

/**
 * Fait tourner un envoi sur l'onglet Boissons donné (lignes après l'en-tête)
 * et rend ce qui est parti, ou l'erreur qui a tout arrêté.
 */
function envoyer(lignesBoissons, entetes = ["Boisson", "Prix d'achat", "Prix de vente", "Marge (DH)", "Coût / prix", "Code équipe", "Prix équipe"]) {
  const boissons = grilleVide(lignesBoissons.length + 1, entetes.length);
  boissons[0] = entetes;
  lignesBoissons.forEach((l, i) => l.forEach((v, j) => { boissons[i + 1][j] = v; }));

  const { ctx, appels } = fauxContexte({
    "Cout par item": new FausseFeuille(coutParItem()),
    "Boissons": new FausseFeuille(boissons),
  }, () => ({ code: 200, corps: '{"produits":0}' }));
  vm.createContext(ctx);
  for (const f of ["Snack.js", "Carte.js", "Boissons.js", "CarteAppli.js", "JournalSnack.js", "Envoi.js"]) {
    vm.runInContext(fs.readFileSync(path.join(SCRIPT, f), "utf8"), ctx, { filename: f });
  }
  try {
    vm.runInContext("envoyerPrix_()", ctx);
    return { prix: appels[0].prix };
  } catch (e) {
    return { erreur: e.message, envoye: appels.length };
  }
}

const trouver = (prix, code) => prix.find((p) => p.code === code);

console.log("\nPrix envoyé pour une boisson");
{
  // Coca acheté 4 DH, vendu 10 au client, 6 à l'équipe.
  const r = envoyer([["Coca / Hawai", 4, 10, "", "", "coca", 6]]);
  const coca = r.prix && trouver(r.prix, "coca");
  verifier(coca && coca.prix_unitaire === 6,
    "c'est le prix équipe, pas le prix d'achat", JSON.stringify(coca ?? r));
  verifier(coca && coca.libelle === "Coca / Hawai",
    "le nom de la boisson accompagne le code", JSON.stringify(coca ?? r));
}
{
  const r = envoyer([["Eau 1,5 L", 5, 10, "", "", "eau", ""]]);
  const eau = r.prix && trouver(r.prix, "eau");
  verifier(eau && eau.prix_unitaire === 5,
    "sans prix équipe, on retombe sur le prix d'achat", JSON.stringify(eau ?? r));
}
{
  // Colonne « Prix équipe » pas encore créée : comportement d'avant.
  const r = envoyer([["Eau 1,5 L", 5, 10, "", "", "eau"]],
    ["Boisson", "Prix d'achat", "Prix de vente", "Marge (DH)", "Coût / prix", "Code équipe"]);
  const eau = r.prix && trouver(r.prix, "eau");
  verifier(eau && eau.prix_unitaire === 5,
    "sans la colonne « Prix équipe », le prix d'achat suffit", JSON.stringify(eau ?? r));
}

console.log("\nCe qui ne doit pas partir");
{
  const r = envoyer([["Théière", "", 10, "", "", "theiere", ""]]);
  verifier(r.erreur && /Théière/.test(r.erreur) && /ligne 2/.test(r.erreur),
    "un code sans aucun prix arrête l'envoi en nommant la ligne", r.erreur);
  verifier(r.envoye === 0,
    "et rien n'est parti à l'appli — ni prix, ni carte", r.envoye);
}
{
  const r = envoyer([["Pom's", 5, 10, "", "", "", ""]]);
  const codes = r.prix && r.prix.map((p) => p.code);
  verifier(codes && codes.join() === "kefta",
    "une boisson sans code n'est pas proposée à l'équipe", JSON.stringify(codes ?? r));
}
{
  const r = envoyer([["Kefta en boisson", 5, 10, "", "", "kefta", 6]]);
  verifier(r.erreur && /kefta/.test(r.erreur) && /deux fois/.test(r.erreur),
    "un code déjà pris par un ingrédient arrête l'envoi", r.erreur);
}

console.log("\nOrdre de la liste");
{
  const r = envoyer([["Coca / Hawai", 4, 10, "", "", "coca", 6], ["Bière", 16, 35, "", "", "biere", 6]]);
  const codes = r.prix && r.prix.map((p) => p.code);
  verifier(codes && codes.join() === "kefta,coca,biere",
    "les boissons sont listées après les ingrédients", JSON.stringify(codes ?? r));
  verifier(r.prix && r.prix.every((p, i) => p.position === i),
    "les positions se suivent sans trou", JSON.stringify(r.prix));
}

/**
 * Ce que le menu écrit dans l'onglet Boissons avant d'envoyer : le code, qui
 * ne changera plus, et le prix équipe. `reponse` est ce qui est tapé dans la
 * fenêtre du prix (null = renoncer), `confirme` la réponse à la confirmation.
 */
function ajouter(lignesBoissons, { debut = 2, nb = 1, reponse = "", confirme = true,
  entetes = ["Boisson", "Prix d'achat", "Prix de vente", "Marge (DH)", "Coût / prix"] } = {}) {
  const g = grilleVide(lignesBoissons.length + 1, entetes.length);
  g[0] = entetes;
  lignesBoissons.forEach((l, i) => l.forEach((v, j) => { g[i + 1][j] = v; }));
  const b = new FausseFeuille(g);
  b.getActiveRange = () => ({ getRow: () => debut, getNumRows: () => nb });

  const { ctx } = fauxContexte({
    "Cout par item": new FausseFeuille(coutParItem()),
    "Boissons": b,
  }, () => ({ code: 200, corps: '{"produits":0}' }));
  ctx.SpreadsheetApp.getUi = () => ({
    ButtonSet: { OK_CANCEL: "ok_cancel" },
    Button: { OK: "ok" },
    prompt: () => ({
      getSelectedButton: () => (reponse === null ? "annule" : "ok"),
      getResponseText: () => String(reponse ?? ""),
    }),
    alert: () => (confirme ? "ok" : "annule"),
  });
  vm.createContext(ctx);
  for (const f of ["Snack.js", "Carte.js", "Boissons.js", "CarteAppli.js", "JournalSnack.js", "Envoi.js"]) {
    vm.runInContext(fs.readFileSync(path.join(SCRIPT, f), "utf8"), ctx, { filename: f });
  }
  ctx.__b = b;
  try {
    return { n: vm.runInContext("ajouterBoissonsALaPageSnack_(__b)", ctx), grille: b.g };
  } catch (e) {
    return { erreur: e.message, grille: b.g };
  }
}

console.log("\nMenu « Ajouter à la page Snack de l'équipe » depuis les Boissons");
{
  const r = ajouter([["Coca / Hawai", 4, 10]]);
  verifier(r.grille[0][5] === "Code équipe" && r.grille[0][6] === "Prix équipe",
    "les deux colonnes sont créées à la suite", JSON.stringify(r.grille[0]));
  verifier(r.grille[1][5] === "coca_hawai", "le code est tiré du nom", JSON.stringify(r.grille[1]));
  verifier(r.grille[1][6] === 6, "le prix équipe par défaut est 6 DH", JSON.stringify(r.grille[1]));
  verifier(r.grille[1][1] === 4 && r.grille[1][2] === 10,
    "les prix d'achat et de vente ne bougent pas", JSON.stringify(r.grille[1]));
}
{
  const r = ajouter([["Coca / Hawai", 4, 10], ["Bière", 16, 35], ["Café", "", 10]], { nb: 3 });
  verifier(r.n === 3, "toute la sélection est traitée d'un coup", r.n);
  verifier(r.grille.slice(1).map((l) => l[5]).join() === "coca_hawai,biere,cafe",
    "chaque boisson reçoit son code", JSON.stringify(r.grille.slice(1).map((l) => l[5])));
  verifier(r.grille.slice(1).every((l) => l[6] === 6),
    "toutes au même prix, même sans prix d'achat connu", JSON.stringify(r.grille.slice(1).map((l) => l[6])));
}
{
  const r = ajouter([["Coca / Hawai", 4, 10]], { reponse: "8,5" });
  verifier(r.grille[1][6] === 8.5, "un autre prix peut être tapé, virgule comprise", r.grille[1][6]);
}
{
  const r = ajouter([["Coca / Hawai", 4, 10]], { reponse: "gratuit" });
  verifier(r.erreur && /gratuit/.test(r.erreur), "un prix illisible est refusé", r.erreur);
  verifier(r.grille[1].length === 5, "et rien n'est écrit dans la feuille", JSON.stringify(r.grille[1]));
}
{
  const r = ajouter([["Coca / Hawai", 4, 10]], { reponse: null });
  verifier(r.n === 0 && r.grille[1].length === 5,
    "renoncer à la fenêtre du prix n'écrit rien", JSON.stringify(r.grille[1]));
}
{
  const r = ajouter([["Coca / Hawai", 4, 10]], { confirme: false });
  verifier(r.n === 0 && r.grille[1][5] === undefined,
    "renoncer à la confirmation n'écrit aucun code", JSON.stringify(r.grille[1]));
}
{
  const r = ajouter([["Coca / Hawai", 4, 10, "", "", "coca_2015", ""]], {
    reponse: "7",
    entetes: ["Boisson", "Prix d'achat", "Prix de vente", "Marge (DH)", "Coût / prix", "Code équipe", "Prix équipe"],
  });
  verifier(r.grille[1][5] === "coca_2015",
    "un code déjà posé n'est jamais remplacé", r.grille[1][5]);
  verifier(r.grille[1][6] === 7, "mais son prix équipe se met à jour", r.grille[1][6]);
}
{
  // « kefta » est déjà le code d'un ingrédient : la boisson en reçoit un autre.
  const r = ajouter([["Kefta", 5, 10]]);
  verifier(r.grille[1][5] === "kefta_2", "un code déjà pris est décliné", r.grille[1][5]);
}
{
  const r = ajouter([["", "", ""]]);
  verifier(r.erreur && /sélectionnez/.test(r.erreur),
    "une ligne vide demande de cliquer sur une boisson", r.erreur);
}

console.log(echecs === 0 ? "\nTout est vert.\n" : `\n${echecs} échec(s).\n`);
process.exit(echecs === 0 ? 0 : 1);
