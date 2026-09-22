/**
 * Envoi des prix coûtants à l'appli KasbahCalendar (page Snack de l'équipe).
 *
 * Les ingrédients envoyés sont ceux qui ont un code dans la colonne
 * « Code équipe » (repérée par son en-tête en ligne 2, à droite des produits).
 * Le code est l'identifiant fixe du produit dans l'appli (`kefta`,
 * `pain_burger`…) : on peut renommer l'ingrédient, jamais changer son code.
 *
 * Le prix envoyé est celui de la colonne E (Prix/unité), tel que la feuille
 * l'a calculé. L'appli remplace toute sa liste à chaque envoi.
 *
 * Le même envoi porte la carte de vente, si l'onglet « Carte appli »
 * existe (CarteAppli.js). Au retour, le même passage va chercher les
 * ventes faites dans l'appli et les écrit dans l'onglet « Journal Snack »
 * (JournalSnack.js).
 *
 * Réglages (Propriétés du script) : PRIX_SNACK_SECRET, posé par le menu
 * « Configurer l'envoi à l'appli ».
 */

const URL_IMPORT_PRIX = 'https://tggdwwvdlrgncbntxkfs.supabase.co/functions/v1/import-prix-snack';
const ENTETE_CODE = 'Code équipe';
// Boissons : ce que l'équipe paie, et non le prix d'achat (colonne B).
const ENTETE_PRIX_EQUIPE = 'Prix équipe';
const PRIX_EQUIPE_BOISSON = 6;

// Codes proposés à la création de la colonne, d'après le nom de l'ingrédient.
const CODES_PROPOSES = [
  [/kefta/i, 'kefta'],
  [/nugget/i, 'nuggets'],
  [/dinde/i, 'dinde'],
  [/^frites?$/i, 'frites'],
  [/pain\s*burger/i, 'pain_burger'],
  [/pain\s*panini/i, 'pain_panini'],
];

function envoyerPrixAppli() {
  const ui = SpreadsheetApp.getUi();
  try {
    const r = envoyerPrix_();
    ui.alert(`Prix envoyés à l'appli : ${r.produits} produit(s)`
      + (r.carte ? `, ${r.carte} article(s) de la carte.` : '.')
      + (r.ventes_ecrites ? `

${r.ventes_ecrites} vente(s) ajoutée(s) au Journal Snack.` : ''));
  } catch (e) {
    ui.alert(`Envoi impossible : ${e.message}`);
  }
}

/** Appelée par le déclencheur du soir : pas de fenêtre, une erreur part dans les journaux. */
function envoyerPrixAppliSoir() {
  envoyerPrix_();
}

function envoyerPrix_() {
  const secret = PropertiesService.getScriptProperties().getProperty('PRIX_SNACK_SECRET');
  if (!secret) throw new Error('secret absent : menu Snack → Configurer l\'envoi à l\'appli.');

  const f = feuille_();
  const der = derniereLigneIngredient_(f);
  const colCode = colonneCode_(f, der);
  const n = der - PREMIERE_LIGNE + 1;
  const noms = f.getRange(PREMIERE_LIGNE, 2, n, 1).getValues();
  const prixUnite = f.getRange(PREMIERE_LIGNE, COL_LIBELLES, n, 1).getValues();
  const codes = f.getRange(PREMIERE_LIGNE, colCode, n, 1).getValues();

  const prix = [];
  const vus = {};
  const ajouter = (codeBrut, nom, p, ou, colPrix) => {
    const code = String(codeBrut).trim();
    if (!code) return;
    if (!/^[a-z][a-z0-9_]{1,29}$/.test(code)) {
      throw new Error(`code « ${code} » (${ou}) : minuscules, chiffres ou _ seulement.`);
    }
    if (vus[code]) throw new Error(`code « ${code} » utilisé deux fois.`);
    vus[code] = true;
    if (typeof p !== 'number' || p <= 0) {
      throw new Error(`${nom} (${ou}) : pas de prix ${colPrix}.`);
    }
    prix.push({ code: code, libelle: String(nom).trim(), prix_unitaire: p, position: prix.length });
  };
  for (let i = 0; i < n; i++) {
    ajouter(codes[i][0], noms[i][0], prixUnite[i][0], `${FEUILLE}, ligne ${PREMIERE_LIGNE + i}`, 'unitaire en colonne E');
  }

  ajouterBoissons_(ajouter);
  if (prix.length === 0) throw new Error(`aucun code dans la colonne « ${ENTETE_CODE} ».`);

  // Carte de vente (onglet « Carte appli », CarteAppli.js) : envoyée avec
  // les prix quand l'onglet existe.
  const carte = lireCarte_();
  const corpsEnvoi = { prix: prix };
  if (carte) corpsEnvoi.carte = carte.map(({ ligne, ...a }) => a);

  const rep = UrlFetchApp.fetch(URL_IMPORT_PRIX, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-import-secret': secret },
    payload: JSON.stringify(corpsEnvoi),
    muteHttpExceptions: true,
  });
  const corps = rep.getContentText();
  if (rep.getResponseCode() !== 200) {
    throw new Error(`l'appli a répondu ${rep.getResponseCode()} : ${corps}`);
  }
  noterPrixEnvoyes_(carte);
  // Retour : les ventes du snack pour le « Journal Snack ». Jamais bloquant
  // — l'envoi des prix est déjà fait et ne doit pas être remis en cause.
  const ventes = tirerVentesSnack_(secret);
  return Object.assign(JSON.parse(corps), { ventes_ecrites: ventes });
}

/**
 * Boissons proposées à l'équipe : onglet « Boissons », un code dans la
 * colonne « Code équipe » (en-tête en ligne 1). Listées après les
 * ingrédients.
 *
 * Le prix envoyé est celui de la colonne « Prix équipe » — ce que l'équipe
 * paie (6 DH par défaut), et non le prix d'achat : une boisson n'est pas
 * cédée à prix coûtant comme un ingrédient. Sans « Prix équipe » rempli, on
 * retombe sur le prix d'achat (colonne B).
 */
function ajouterBoissons_(ajouter) {
  const b = SpreadsheetApp.getActive().getSheetByName(FEUILLE_BOISSONS);
  if (!b || b.getLastRow() < 2) return;
  const entetes = b.getRange(1, 1, 1, b.getLastColumn()).getValues()[0].map((e) => String(e).trim());
  const colCode = entetes.indexOf(ENTETE_CODE) + 1;
  if (!colCode) return;
  const colPrix = entetes.indexOf(ENTETE_PRIX_EQUIPE) + 1;
  const largeur = Math.max(colCode, colPrix, 2);
  b.getRange(2, 1, b.getLastRow() - 1, largeur).getValues().forEach((l, i) => {
    const nom = String(l[0]).trim();
    if (!nom) return;
    const prixEquipe = colPrix ? l[colPrix - 1] : '';
    const aPrixEquipe = typeof prixEquipe === 'number' && prixEquipe > 0;
    ajouter(l[colCode - 1], nom, aPrixEquipe ? prixEquipe : l[1],
      `${FEUILLE_BOISSONS}, ligne ${i + 2}`,
      colPrix ? `« ${ENTETE_PRIX_EQUIPE} » ni d'achat en colonne B` : "d'achat en colonne B");
  });
}

/**
 * Colonne « Code équipe » : retrouvée par son en-tête ; créée au premier
 * envoi, une colonne après le dernier produit, pré-remplie d'après les noms.
 */
function colonneCode_(f, der) {
  const entetes = f.getRange(LIGNE_ENTETE, 1, 1, f.getLastColumn()).getValues()[0];
  const i = entetes.findIndex((e) => String(e).trim() === ENTETE_CODE);
  if (i >= 0) return i + 1;

  const col = derniereColonneProduit_(f) + 2;
  if (col > f.getMaxColumns()) f.insertColumnsAfter(f.getMaxColumns(), col - f.getMaxColumns());
  f.getRange(LIGNE_ENTETE, col).setValue(ENTETE_CODE).setFontWeight('bold');
  const noms = f.getRange(PREMIERE_LIGNE, 2, der - PREMIERE_LIGNE + 1, 1).getValues();
  f.getRange(PREMIERE_LIGNE, col, noms.length, 1).setValues(noms.map((l) => {
    const nom = String(l[0]).trim();
    const trouve = CODES_PROPOSES.find(([re]) => re.test(nom));
    return [trouve ? trouve[1] : ''];
  })).setBackground('#fff2cc');
  return col;
}

/**
 * Menu « Ajouter à la page Snack de l'équipe » : l'ingrédient de la ligne
 * sélectionnée reçoit un code (tiré de son nom, unique), puis les prix
 * partent à l'appli. Le prix est vérifié avant d'écrire le code : un code
 * sans prix bloquerait tous les envois suivants, y compris celui du soir.
 *
 * Depuis l'onglet « Boissons », le même menu ajoute les boissons
 * sélectionnées, au prix équipe demandé (6 DH par défaut).
 */
function ajouterALaPageSnack() {
  const ui = SpreadsheetApp.getUi();
  try {
    const active = SpreadsheetApp.getActiveSheet();
    if (active.getName() === FEUILLE_BOISSONS) {
      const n = ajouterBoissonsALaPageSnack_(active);
      if (!n) return;
      const rep = envoyerPrix_();
      ui.alert(`${n} boisson(s) sur la page Snack (${rep.produits} produit(s) envoyés).`);
      return;
    }
    const f = feuille_();
    if (active.getName() !== FEUILLE) {
      throw new Error(`cliquez d'abord sur la ligne de l'ingrédient dans l'onglet « ${FEUILLE} », `
        + `ou sur celle de la boisson dans « ${FEUILLE_BOISSONS} ».`);
    }
    const r = f.getActiveCell().getRow();
    const der = derniereLigneIngredient_(f);
    if (r < PREMIERE_LIGNE || r > der) {
      throw new Error('cliquez d\'abord sur la ligne de l\'ingrédient (colonne B remplie).');
    }
    const nom = String(f.getRange(r, 2).getValue()).trim();
    const prix = f.getRange(r, COL_LIBELLES).getValue();
    if (typeof prix !== 'number' || prix <= 0) {
      throw new Error(`« ${nom} » n'a pas de prix unitaire en colonne E : remplissez quantité achetée et prix d'abord.`);
    }

    const colCode = colonneCode_(f, der);
    const caseCode = f.getRange(r, colCode);
    let code = String(caseCode.getValue()).trim();
    if (!code) {
      code = codeLibre_(codePour_(nom), codesPris_());
      const ok = ui.alert('Page Snack de l\'équipe',
        `« ${nom} » sera proposé à l'équipe à ${prix.toFixed(2)} DH l'unité (code ${code}).\n\n`
        + 'Vous pourrez renommer l\'ingrédient, mais pas changer ce code. Continuer ?',
        ui.ButtonSet.OK_CANCEL);
      if (ok !== ui.Button.OK) return;
      caseCode.setValue(code).setBackground('#fff2cc');
    }
    const rep = envoyerPrix_();
    ui.alert(`« ${nom} » est sur la page Snack (${rep.produits} produit(s) envoyés).`);
  } catch (e) {
    ui.alert(`Impossible : ${e.message}`);
  }
}

/**
 * Les boissons des lignes sélectionnées dans l'onglet « Boissons » reçoivent
 * un code et un prix équipe. Rend le nombre de boissons à envoyer, 0 si
 * l'utilisateur a renoncé — rien n'est écrit avant sa confirmation.
 *
 * Le prix équipe est demandé une fois pour toute la sélection : les boissons
 * sont au même prix (6 DH), contrairement aux ingrédients cédés à leur coût.
 */
function ajouterBoissonsALaPageSnack_(b) {
  const ui = SpreadsheetApp.getUi();
  const sel = b.getActiveRange();
  const fin = Math.min(sel.getRow() + sel.getNumRows() - 1, b.getLastRow());
  const lignes = [];
  for (let r = Math.max(sel.getRow(), 2); r <= fin; r++) {
    const nom = String(b.getRange(r, 1).getValue()).trim();
    if (nom) lignes.push({ ligne: r, nom: nom });
  }
  if (!lignes.length) {
    throw new Error("sélectionnez d'abord la ou les lignes des boissons (colonne A remplie).");
  }

  const saisie = ui.prompt("Page Snack de l'équipe",
    lignes.map((l) => l.nom).join(', ') + '\n\n'
    + `Prix payé par l'équipe, en DH (vide = ${PRIX_EQUIPE_BOISSON}) :`, ui.ButtonSet.OK_CANCEL);
  if (saisie.getSelectedButton() !== ui.Button.OK) return 0;
  const tape = saisie.getResponseText().trim();
  const prix = tape === '' ? PRIX_EQUIPE_BOISSON : Number(tape.replace(',', '.'));
  if (!(prix > 0)) throw new Error(`prix « ${tape} » illisible.`);

  const colCode = colonneBoissons_(b, ENTETE_CODE);
  const colPrix = colonneBoissons_(b, ENTETE_PRIX_EQUIPE);
  const pris = codesPris_();
  lignes.forEach((l) => {
    l.code = String(b.getRange(l.ligne, colCode).getValue()).trim();
    if (l.code) return;
    l.code = codeLibre_(codePour_(l.nom), pris);
    pris.push(l.code);
  });

  const ok = ui.alert("Page Snack de l'équipe",
    lignes.map((l) => `${l.nom} → ${prix.toFixed(2)} DH (code ${l.code})`).join('\n') + '\n\n'
    + 'Vous pourrez renommer la boisson et changer son prix, mais pas changer son code. Continuer ?',
    ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return 0;

  lignes.forEach((l) => {
    b.getRange(l.ligne, colCode).setValue(l.code).setBackground(JAUNE);
    b.getRange(l.ligne, colPrix).setValue(prix).setNumberFormat('0.00').setBackground(JAUNE);
  });
  return lignes.length;
}

/** Colonne de l'onglet Boissons portant cet en-tête (ligne 1) ; créée au bout si absente. */
function colonneBoissons_(b, entete) {
  const entetes = b.getRange(1, 1, 1, b.getLastColumn()).getValues()[0].map((e) => String(e).trim());
  const i = entetes.indexOf(entete);
  if (i >= 0) return i + 1;
  const col = b.getLastColumn() + 1;
  if (col > b.getMaxColumns()) b.insertColumnsAfter(b.getMaxColumns(), col - b.getMaxColumns());
  b.getRange(1, col).setValue(entete).setFontWeight('bold');
  return col;
}

/**
 * Tous les codes déjà attribués, ingrédients et boissons : un code servant
 * deux fois ferait échouer l'envoi entier, boissons comprises.
 */
function codesPris_() {
  const ss = SpreadsheetApp.getActive();
  const pris = [];
  const ramasser = (f, ligneEntete, premiere) => {
    if (!f || f.getLastRow() < premiere) return;
    const col = f.getRange(ligneEntete, 1, 1, f.getLastColumn()).getValues()[0]
      .findIndex((e) => String(e).trim() === ENTETE_CODE) + 1;
    if (!col) return;
    f.getRange(premiere, col, f.getLastRow() - premiere + 1, 1).getValues()
      .forEach((l) => { const c = String(l[0]).trim(); if (c) pris.push(c); });
  };
  ramasser(ss.getSheetByName(FEUILLE), LIGNE_ENTETE, PREMIERE_LIGNE);
  ramasser(ss.getSheetByName(FEUILLE_BOISSONS), 1, 2);
  return pris;
}

/** Code tiré du nom : proposé s'il est connu, sinon minuscules sans accents, mots reliés par _. */
function codePour_(nom) {
  const connu = CODES_PROPOSES.find(([re]) => re.test(nom));
  if (connu) return connu[1];
  let code = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!/^[a-z]/.test(code)) code = 'p_' + code;
  code = code.slice(0, 27).replace(/_+$/, '');
  return code.length >= 2 ? code : 'produit';
}

/** Ajoute _2, _3… si le code est déjà pris dans la colonne. */
function codeLibre_(code, pris) {
  if (!pris.includes(code)) return code;
  let i = 2;
  while (pris.includes(`${code}_${i}`)) i++;
  return `${code}_${i}`;
}

function configurerEnvoi() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Envoi à l\'appli', 'Secret IMPORT_PRIX_SNACK_SECRET (le même que dans Lovable Cloud) :', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK || !r.getResponseText().trim()) return;
  PropertiesService.getScriptProperties().setProperty('PRIX_SNACK_SECRET', r.getResponseText().trim());
  ui.alert('Secret enregistré.');
}

/** Envoi automatique chaque soir vers 22h30 (un seul déclencheur, même relancé). */
function programmerEnvoiSoir() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'envoyerPrixAppliSoir')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('envoyerPrixAppliSoir').timeBased().atHour(22).nearMinute(30).everyDays(1).create();
  SpreadsheetApp.getUi().alert('Envoi programmé chaque soir vers 22h30.');
}
