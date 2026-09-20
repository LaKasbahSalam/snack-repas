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

  // Onglet Boissons : même colonne « Code équipe » (en-tête en ligne 1),
  // prix envoyé = prix d'achat (colonne B). Listées après les ingrédients.
  const b = SpreadsheetApp.getActive().getSheetByName(FEUILLE_BOISSONS);
  if (b && b.getLastRow() > 1) {
    const colB = b.getRange(1, 1, 1, b.getLastColumn()).getValues()[0]
      .findIndex((e) => String(e).trim() === ENTETE_CODE) + 1;
    if (colB) {
      const lignes = b.getRange(2, 1, b.getLastRow() - 1, Math.max(colB, 2)).getValues();
      lignes.forEach((l, i) => {
        if (String(l[0]).trim()) ajouter(l[colB - 1], l[0], l[1], `${FEUILLE_BOISSONS}, ligne ${i + 2}`, "d'achat en colonne B");
      });
    }
  }
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
 */
function ajouterALaPageSnack() {
  const ui = SpreadsheetApp.getUi();
  try {
    const f = feuille_();
    if (SpreadsheetApp.getActiveSheet().getName() !== FEUILLE) {
      throw new Error(`cliquez d'abord sur la ligne de l'ingrédient dans l'onglet « ${FEUILLE} ».`);
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
      const pris = f.getRange(PREMIERE_LIGNE, colCode, der - PREMIERE_LIGNE + 1, 1).getValues()
        .map((l) => String(l[0]).trim());
      code = codeLibre_(codePour_(nom), pris);
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
