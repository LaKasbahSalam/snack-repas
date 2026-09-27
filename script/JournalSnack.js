/**
 * Onglet « Journal Snack » : une ligne par article vendu dans l'appli.
 *
 * Décision Karim du 27/09/2026 : le classeur seul fait foi. L'appli
 * n'envoie que les faits de la vente ; tout ce qui se calcule est une
 * formule, qui va chercher l'article PAR SON CODE (colonne M) dans « Carte
 * appli », dont les colonnes « Coût revient » et « Part vendeur »
 * cherchent à leur tour dans « Items & Sandwichs » et « Boissons » (voir
 * PartVendeur.js). Aucun renvoi vers une ligne fixe : trier ou déplacer
 * « Carte appli » ne casse rien, et la même formule sert à toutes les
 * lignes (tirer vers le bas suffit).
 *
 *   A Id                    numéro de la vente dans l'appli (le même pour
 *                           chacun de ses articles)
 *   B Date                  jour de la vente (heure de Fès)
 *   C Description           l'article, à qui, par qui
 *   D Montant               formule =N×O
 *   E Montant total cumulé  formule, cumul de la colonne D
 *   F Client                à qui (nom de la fiche, ou « pas dans la liste »)
 *   G Vendeur               pseudo de qui a vendu
 *   H Part vendeur          formule =MAX(0;ARRONDI(K×(1−L);2))
 *   I Part hôtel            formule =D−H
 *   J Cout                  formule =N×(coût de l'article + frites si P) ;
 *                           coût vide ou nul : =D, bénéfice nul
 *   K Benefice              formule =D−J
 *   L Commission hotel      formule =1−part vendeur de l'article ;
 *                           article introuvable : 100 %, rien au vendeur
 *   M Code                  code de l'article dans l'appli
 *   N Quantite              combien
 *   O Prix unitaire         prix payé à la pièce, frites comprises
 *   P Frites                VRAI si l'article est pris avec frites
 *
 * Les colonnes A à L gardent leur place d'avant (les onglets qui les
 * lisent, comme « Snack/mois », continuent de marcher) ; M à P s'ajoutent.
 * Les lignes d'avant le 27/09 restent telles qu'elles ont été écrites.
 *
 * Les formules sont vivantes : changer un coût ou une part vendeur dans
 * « Items & Sandwichs » ou « Boissons » change aussi les lignes passées,
 * et un coût ajouté après coup corrige les ventes où il manquait.
 *
 * Les formules sont écrites avec le séparateur de la langue du classeur
 * (« ; » en français), détecté par separateur_() : le mauvais donne
 * #ERROR! (27/09/2026).
 *
 * Le sens est un TIRAGE, comme pour la caisse du classeur Exercices :
 * c'est ce script qui demande les ventes à l'appli, les écrit, puis
 * accuse réception. L'appli n'écrit jamais dans le classeur — pas de
 * compte de service Google, pas de clé privée à garder.
 *
 * L'accusé part APRÈS l'écriture, et ne porte que sur les ventes
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
const ENTETES_JOURNAL = ['Id', 'Date', 'Description', 'Montant', 'Montant total cumule',
  'Client', 'Vendeur', 'Part vendeur', 'Part hotel', 'Cout', 'Benefice', 'Commission hotel',
  'Code', 'Quantite', 'Prix unitaire', 'Frites'];

/**
 * Va chercher les ventes et les écrit. Rend le nombre de lignes ajoutées.
 * Ne lève jamais : une panne côté ventes ne doit pas faire échouer l'envoi
 * des prix, qui est le travail principal. Le détail part dans les journaux.
 */
function tirerVentesSnack_(secret) {
  try {
    const j = SpreadsheetApp.getActive().getSheetByName(FEUILLE_JOURNAL);
    if (!j) return 0; // onglet absent : rien à faire, l'envoi des prix continue.

    const lignes = demanderVentes_(secret);
    if (lignes.length === 0) return 0;
    // Base pas encore migrée (une ligne par vente, avec la prime de
    // l'appli) : rien n'est écrit ni accusé, les ventes attendent.
    if (!('code' in lignes[0])) {
      console.error('Journal Snack : la base envoie encore l\'ancien format, '
        + 'exécuter 20260927110000_snack_prime_au_classeur.sql');
      return 0;
    }
    const carte = carteDuJournal_();

    // Ligne d'en-tête si l'onglet est vierge ; sur un onglet plus ancien,
    // seules les en-têtes manquantes à partir de F sont posées.
    if (j.getLastRow() === 0) {
      j.getRange(1, 1, 1, ENTETES_JOURNAL.length).setValues([ENTETES_JOURNAL])
        .setFontWeight('bold').setBackground('#efefef');
      j.setFrozenRows(1);
    } else {
      const entete = j.getRange(1, 1, 1, ENTETES_JOURNAL.length).getValues()[0];
      ENTETES_JOURNAL.forEach((e, k) => {
        if (k >= 5 && entete[k] === '') {
          j.getRange(1, k + 1).setValue(e).setFontWeight('bold').setBackground('#efefef');
        }
      });
    }

    // Ce que l'onglet a déjà, pour ne rien écrire deux fois même si un
    // accusé s'est perdu en route.
    const deja = {};
    if (j.getLastRow() > 1) {
      j.getRange(2, 1, j.getLastRow() - 1, 1).getValues()
        .forEach((l) => { if (l[0] !== '') deja[String(l[0]).trim()] = true; });
    }
    const ids = (ls) => ls.map((l) => l.id).filter((id, i, t) => t.indexOf(id) === i);
    const aEcrire = lignes.filter((l) => !deja[String(l.id)]);
    if (aEcrire.length === 0) {
      accuserVentes_(secret, ids(lignes)); // déjà là : on les marque.
      return 0;
    }

    // Les faits : ce que l'appli sait de la vente.
    const depart = j.getLastRow() + 1;
    const n = aEcrire.length;
    j.getRange(depart, 1, n, 3).setValues(aEcrire.map((l) => [
      l.id,
      jourDe_(l.date_vente),
      String(l.description || '').slice(0, 500),
    ]));
    j.getRange(depart, 6, n, 2).setValues(aEcrire.map((l) => [
      String(l.client || '').slice(0, 200),
      String(l.vendeur || '').slice(0, 50),
    ]));
    j.getRange(depart, 13, n, 4).setValues(aEcrire.map((l) => [
      String(l.code || ''),
      Number(l.quantite) || 0,
      Number(l.prix_unitaire) || 0,
      l.avec_frites === true,
    ]));

    // Le reste : des formules, les mêmes sur chaque ligne au numéro près.
    SEP = separateur_(j);
    const C = `'${FEUILLE_CARTE}'!`;
    const colonne = (l) => `${C}$${l}:$${l}`;
    const chercher = (quoi, code) => `INDEX(${colonne(quoi)},MATCH(${code},${colonne(carte.code)},0))`;
    j.getRange(depart, 4, n, 2).setFormulas(aEcrire.map((_, i) => {
      const r = depart + i;
      return [`=N${r}*O${r}`, r === 2 ? `=D${r}` : `=N(E${r - 1})+D${r}`];
    }));
    j.getRange(depart, 8, n, 5).setFormulas(aEcrire.map((_, i) => {
      const r = depart + i;
      return [
        fx_(`=MAX(0,ROUND(K${r}*(1-L${r}),2))`),
        `=D${r}-H${r}`,
        fx_(`=LET(cout_article,N(IFERROR(${chercher(carte.cout, `M${r}`)},0)),`
          + `cout_frites,N(IFERROR(${chercher(carte.cout, `"${CODE_SUPPLEMENT_FRITES}"`)},0)),`
          + `IF(OR(cout_article<=0,AND(P${r},cout_frites<=0)),D${r},N${r}*(cout_article+IF(P${r},cout_frites,0))))`),
        `=D${r}-J${r}`,
        fx_(`=IFERROR(1-${chercher(carte.part, `M${r}`)},1)`),
      ];
    }));
    j.getRange(depart, 2, n, 1).setNumberFormat('dd/mm/yyyy');
    j.getRange(depart, 4, n, 2).setNumberFormat('0.00');
    j.getRange(depart, 8, n, 4).setNumberFormat('0.00');
    j.getRange(depart, 12, n, 1).setNumberFormat('0%');
    j.getRange(depart, 15, n, 1).setNumberFormat('0.00');

    // Écrit pour de bon avant d'accuser réception : si le script s'arrête
    // ici (temps dépassé), les lignes sont dans l'onglet et l'accusé
    // repartira au prochain passage, le doublon étant écarté par `deja`.
    SpreadsheetApp.flush();
    accuserVentes_(secret, ids(aEcrire));
    return n;
  } catch (e) {
    console.error(`Journal Snack : ${e.message}`);
    return 0;
  }
}

/**
 * « Carte appli » vue par le Journal : la lettre des colonnes Code, « Coût
 * revient » et « Part vendeur ». Lève si l'une manque : rien n'est alors
 * écrit ni accusé.
 */
function carteDuJournal_() {
  const c = SpreadsheetApp.getActive().getSheetByName(FEUILLE_CARTE);
  if (!c || c.getLastRow() < 2) throw new Error(`onglet « ${FEUILLE_CARTE} » absent ou vide.`);
  const entetes = c.getRange(1, 1, 1, c.getLastColumn()).getValues()[0].map((e) => String(e).trim());
  const code = entetes.indexOf('Code') + 1;
  const cout = entetes.indexOf(ENTETE_COUT_CARTE) + 1;
  const part = entetes.indexOf(LIBELLE_PART) + 1;
  if (!code || !cout || !part) {
    throw new Error(`« ${FEUILLE_CARTE} » sans colonnes Code, ${ENTETE_COUT_CARTE} et ${LIBELLE_PART}.`);
  }
  return { code: lettre_(code), cout: lettre_(cout), part: lettre_(part) };
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
