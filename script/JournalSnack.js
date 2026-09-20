/**
 * Onglet « Journal Snack » : une ligne par vente faite dans l'appli.
 *
 *   A Id                    identifiant de la vente dans l'appli
 *   B Date                  jour de la vente (heure de Fès)
 *   C Description           ce qui a été vendu, à qui, par qui
 *   D Montant               total vendu, prime du vendeur comprise
 *   E Montant total cumulé  formule, cumul de la colonne D
 *
 * Le sens est un TIRAGE, comme pour la caisse du classeur Exercices :
 * c'est ce script qui demande les ventes à l'appli, les écrit, puis
 * accuse réception. L'appli n'écrit jamais dans le classeur — pas de
 * compte de service Google, pas de clé privée à garder.
 *
 * L'accusé part APRÈS l'écriture, et ne porte que sur les lignes
 * réellement écrites. Si l'écriture échoue, rien n'est marqué et le
 * passage suivant les reproposera. L'inverse les perdrait.
 *
 * Le tirage se fait au même moment que l'envoi des prix (menu « Envoyer
 * les prix à l'appli » et passage automatique du soir) : un seul aller-
 * retour, un seul déclencheur à surveiller.
 *
 * Les lignes déjà dans l'onglet ne sont jamais touchées : le script
 * n'écrit qu'en bas. Une correction faite à la main est hors d'atteinte.
 */

const FEUILLE_JOURNAL = 'Journal Snack';
const ENTETES_JOURNAL = ['Id', 'Date', 'Description', 'Montant', 'Montant total cumule'];

/**
 * Va chercher les ventes et les écrit. Rend le nombre de lignes ajoutées.
 * Ne lève jamais : une panne côté ventes ne doit pas faire échouer l'envoi
 * des prix, qui est le travail principal. Le détail part dans les journaux.
 */
function tirerVentesSnack_(secret) {
  try {
    const j = SpreadsheetApp.getActive().getSheetByName(FEUILLE_JOURNAL);
    if (!j) return 0; // onglet absent : rien à faire, l'envoi des prix continue.

    const ventes = demanderVentes_(secret);
    if (ventes.length === 0) return 0;

    // Ligne d'en-tête si l'onglet est vierge.
    if (j.getLastRow() === 0) {
      j.getRange(1, 1, 1, ENTETES_JOURNAL.length).setValues([ENTETES_JOURNAL])
        .setFontWeight('bold').setBackground('#efefef');
      j.setFrozenRows(1);
    }

    // Ce que l'onglet a déjà, pour ne rien écrire deux fois même si un
    // accusé s'est perdu en route.
    const deja = {};
    if (j.getLastRow() > 1) {
      j.getRange(2, 1, j.getLastRow() - 1, 1).getValues()
        .forEach((l) => { if (l[0] !== '') deja[String(l[0]).trim()] = true; });
    }
    const aEcrire = ventes.filter((v) => !deja[String(v.id)]);
    if (aEcrire.length === 0) {
      accuserVentes_(secret, ventes.map((v) => v.id)); // déjà là : on les marque.
      return 0;
    }

    const depart = j.getLastRow() + 1;
    j.getRange(depart, 1, aEcrire.length, 4).setValues(aEcrire.map((v) => [
      v.id,
      jourDe_(v.date_vente),
      String(v.description || '').slice(0, 500),
      Number(v.montant) || 0,
    ]));
    j.getRange(depart, 2, aEcrire.length, 1).setNumberFormat('dd/mm/yyyy');
    j.getRange(depart, 4, aEcrire.length, 1).setNumberFormat('0.00');
    // Cumul : la première ligne part de zéro, les suivantes s'appuient sur
    // la ligne du dessus. Une formule et non une valeur, pour qu'une
    // correction à la main se répercute.
    j.getRange(depart, 5, aEcrire.length, 1).setFormulas(aEcrire.map((_, i) => {
      const r = depart + i;
      return [r === 2 ? `=D${r}` : `=N(E${r - 1})+D${r}`];
    }));
    j.getRange(depart, 5, aEcrire.length, 1).setNumberFormat('0.00');

    // Écrit pour de bon avant d'accuser réception : si le script s'arrête
    // ici (temps dépassé), les lignes sont dans l'onglet et l'accusé
    // repartira au prochain passage, le doublon étant écarté par `deja`.
    SpreadsheetApp.flush();
    accuserVentes_(secret, aEcrire.map((v) => v.id));
    return aEcrire.length;
  } catch (e) {
    console.error(`Journal Snack : ${e.message}`);
    return 0;
  }
}

/** Les ventes que l'onglet n'a pas encore. */
function demanderVentes_(secret) {
  const rep = UrlFetchApp.fetch(URL_IMPORT_PRIX, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-import-secret': secret },
    payload: JSON.stringify({ action: 'ventes', limit: 200 }),
    muteHttpExceptions: true,
  });
  if (rep.getResponseCode() !== 200) {
    throw new Error(`l'appli a répondu ${rep.getResponseCode()} : ${rep.getContentText()}`);
  }
  return JSON.parse(rep.getContentText()).ventes || [];
}

/** Accuse réception des ventes réellement écrites dans l'onglet. */
function accuserVentes_(secret, ids) {
  if (!ids || ids.length === 0) return;
  const rep = UrlFetchApp.fetch(URL_IMPORT_PRIX, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-import-secret': secret },
    payload: JSON.stringify({ action: 'ventes_ack', ids: ids }),
    muteHttpExceptions: true,
  });
  if (rep.getResponseCode() !== 200) {
    // Les lignes sont écrites : l'accusé repartira au prochain passage.
    throw new Error(`accusé refusé (${rep.getResponseCode()}) : ${rep.getContentText()}`);
  }
}

/** « 2026-09-20 » -> une vraie date, lue à midi pour éviter tout décalage. */
function jourDe_(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date();
}
