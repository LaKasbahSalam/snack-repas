/**
 * Un faux Google Sheets, juste assez pour faire tourner les scripts de ce
 * classeur avec Node : une grille de valeurs, et les quelques méthodes que
 * le code appelle réellement.
 *
 * Pourquoi : Apps Script ne s'exécute que chez Google, et une erreur ne se
 * découvre alors qu'en production, sur le classeur qui fait tourner le
 * snack. Ce bouchon permet de vérifier ce qu'un script écrit et ce qu'il
 * envoie avant de le pousser.
 *
 * Ce n'est PAS un vrai Sheets : pas de formules recalculées, pas de mise en
 * forme, pas de fuseau horaire. Les valeurs et les formules écrites sont
 * conservées telles quelles, pour qu'un test puisse les relire.
 */

/** Une feuille vierge de `lignes` × `colonnes` cases. */
function grilleVide(lignes, colonnes) {
  return Array.from({ length: lignes }, () => Array.from({ length: colonnes }, () => ""));
}

class FausseFeuille {
  constructor(grille) {
    this.g = grille;
    this.formules = {};   // { numéro de ligne : formule écrite en colonne E }
    this.lignesGelees = 0;
  }
  getMaxRows() { return this.g.length; }
  getMaxColumns() { return this.g[0].length; }
  setFrozenRows(n) { this.lignesGelees = n; return this; }
  setColumnWidth() { return this; }
  insertColumnsAfter() { return this; }
  getLastRow() {
    for (let r = this.g.length - 1; r >= 0; r--) if (this.g[r].some((v) => v !== "")) return r + 1;
    return 0;
  }
  getLastColumn() {
    let max = 0;
    for (const ligne of this.g) ligne.forEach((v, j) => { if (v !== "") max = Math.max(max, j + 1); });
    return max;
  }
  getRange(r, c, nr = 1, nc = 1) {
    const g = this.g, feuille = this;
    const api = {
      getValues: () => Array.from({ length: nr }, (_, i) =>
        Array.from({ length: nc }, (_, j) => (g[r - 1 + i] ?? [])[c - 1 + j] ?? "")),
      getDisplayValues: () => api.getValues().map((l) => l.map((v) => String(v))),
      getValue: () => api.getValues()[0][0],
      setValue: (v) => { g[r - 1][c - 1] = v; return api; },
      setValues: (vals) => {
        vals.forEach((l, i) => l.forEach((v, j) => { g[r - 1 + i][c - 1 + j] = v; }));
        return api;
      },
      setFormulas: (f) => {
        f.forEach((l, i) => { feuille.formules[r + i] = l[0]; g[r - 1 + i][c - 1] = l[0]; });
        return api;
      },
      // Mise en forme : acceptée et ignorée.
      setNumberFormat: () => api, setBackground: () => api, setFontWeight: () => api,
      setFontColor: () => api, clearContent: () => api, insertCheckboxes: () => api,
    };
    return api;
  }
}

/**
 * Le contexte dans lequel faire tourner les scripts : `feuilles` est un
 * objet { 'nom de l'onglet': FausseFeuille }. `reponses` répond aux appels
 * UrlFetchApp : une fonction qui reçoit le corps envoyé et rend
 * { code, corps }. Les corps envoyés sont collectés dans `appels`.
 */
function fauxContexte(feuilles, reponses) {
  const appels = [];
  return {
    appels,
    ctx: {
      console,
      URL_IMPORT_PRIX: "https://exemple.test/import",
      SpreadsheetApp: {
        getActive: () => ({
          getSheetByName: (n) => feuilles[n] ?? null,
          insertSheet: () => null,
        }),
        getUi: () => ({ alert: () => {}, prompt: () => ({}), ButtonSet: {}, Button: {} }),
        flush: () => {},
      },
      UrlFetchApp: {
        fetch: (_url, options) => {
          const corps = JSON.parse(options.payload);
          appels.push(corps);
          const r = reponses(corps);
          return { getResponseCode: () => r.code, getContentText: () => r.corps };
        },
      },
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => "secret-de-test", setProperty: () => {} }),
      },
    },
  };
}

module.exports = { grilleVide, FausseFeuille, fauxContexte };
