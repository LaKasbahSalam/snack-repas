# Lancement du Snack

## À venir
- [ ] Reporter dans le classeur Gestion de stock les formats et prix notés dans la liste de courses (Claude peut les relire dans la base de l'artefact)
- [ ] **Comptage des stocks** — suivre ce qui est acheté, vendu et consommé par l'équipe (les achats équipe sont déjà marqués `origine = 'equipe'` dans l'appli pour pouvoir les isoler)

## En cours
- [ ] **Prime calculée dans le classeur : mise en service** — script poussé au classeur et base migrée le 27/09/2026. Reste :
  1. ~~Migration `20260927110000_snack_prime_au_classeur.sql`~~ : exécutée par Karim dans la base de l'appli le 27/09/2026, KasbahCalendar poussé.
  2. Menu Snack → « Envoyer les prix à l'appli » : vérifier la ligne « Part vendeur » sous le bloc de « Items & Sandwichs » (80 %), la colonne « Part vendeur » de « Boissons » (bière 0 %), et les colonnes « Coût revient » / « Part vendeur » de « Carte appli » (recherches par le nom ; case vide = nom introuvable, à corriger en colonne C).
  3. Régler les % voulus ; vérifier sur les ventes arrivées que H et I se calculent (une bière : H = 0).
  4. Renommer H1 « pour le vendeur » et I1 « pour l'hôtel » dans le Journal Snack (inversés à la main : H est la part du vendeur).
  5. Supprimer la colonne H « Retenue » de « Carte appli » (plus lue) ; les colonnes de renvoi se recalent d'elles-mêmes au prochain envoi.
- [ ] **Journal Snack : réparer H22:H25 à la main** (`#ERROR!`, anciennes lignes) : en H22 `=(K22>0)*ARRONDI(100*K22*(1-L22))/100`, puis tirer jusqu'à H25 ; I suit d'elle-même — *27/09/2026*
- [ ] **À trancher par Karim** : les bières vendues du 25 au 26/09 ont donné une prime dans l'appli (91,20 et 45,60 à Ayoub, au moins) ; la reprendre ou non
- [ ] **Page de ventes du snack dans l'appli KasbahCalendar** — onglet « Journal » de la page Snack écrit le 21/09/2026 (KasbahCalendar, non commité), reste à livrer et à vérifier connecté
- [ ] Tenir à jour `docs/FICHE-TECHNIQUE.md` : ce que fait chaque bouton des quatre outils, et ce qu'il reste à coder (à relire à chaque nouveau bouton)
- [ ] Compléter la Fiche repas : prix d'achat des nouveaux ingrédients et des boissons, quantités en jaune (tajines, fromage…), prix à aligner sur la carte
- [ ] Proposer les boissons à l'équipe à 6 DH : onglet « Boissons », sélectionner les lignes, menu Snack → « Ajouter à la page Snack de l'équipe » (le script pose le code et le prix équipe)

## Fait
- [x] Prime du vendeur calculée par le classeur seul (décision Karim : le classeur fait foi). Part vendeur en % du bénéfice, réglée par article : ligne « Part vendeur » de « Items & Sandwichs », colonne « Part vendeur » de « Boissons » (bière 0 %). « Carte appli » les cherche par le nom (`PartVendeur.js`). Journal Snack : une ligne par article, faits en valeurs (code, quantité, prix payé, frites), montant, coût, bénéfice, commission et parts en formules qui cherchent l'article par son code : aucun renvoi vers une ligne fixe, un coût ajouté après coup corrige les ventes passées. Tests : `parts.test.js`, `journal.test.js` réécrit. Script poussé au classeur (comparé avant, vérifié après) — 27/09/2026
- [x] Journal Snack : la part vendeur (H) s'écrivait `=MAX(0,ROUND(…,2))`, refusée par le classeur en français (virgule = décimales) → `#ERROR!` sur H et I dès les premières ventes portant coût et taux (25-26/09). Formule réécrite sans séparateur, `=(K>0)*ROUND(100*K*(1-L))/100`, et un test qui interdit « , » et « ; » dans les formules du journal. Envoi relancé : ventes du 24 au 26/09 arrivées. Script poussé au classeur (comparé avant, vérifié après) — 27/09/2026
- [x] Onglet « Cout par item » renommé « Items & Sandwichs » dans le classeur : le script cherchait l'ancien nom et l'envoi à l'appli s'arrêtait (« Onglet introuvable »), Journal Snack bloqué au 24/09. Nom changé dans le script, les tests et la fiche technique ; script poussé au classeur (clasp pull comparé avant : aucune modification en ligne ; vérifié après : en ligne = dépôt) — 27/09/2026
- [x] Prime du vendeur : 80 % du bénéfice, l'hôtel en garde 20 % (au lieu de la retenue en DH). Journal Snack : colonnes J Cout, K Benefice, L Commission hotel ; H et I deviennent des formules sur ces cases pour les nouvelles ventes. La Carte appli n'envoie plus de retenue. Script poussé au classeur (clasp pull comparé : aucune modification en ligne) — 25/09/2026
- [x] Liste de courses sur téléphone (artefact claude.ai, photos, format et prix par article), tirée du classeur Gestion de stock — `courses/` — 23/09/2026
- [x] Photos Pom's et Hawai dans l'appli (page Vente et page Équipe) — KasbahCalendar, `SnackImage.tsx`, non commité — 22/09/2026
- [x] Boissons : prix équipe (6 DH par défaut, au lieu du prix d'achat) envoyé à l'appli via la colonne « Prix équipe » de l'onglet Boissons — 22/09/2026
- [x] Fiche technique des quatre outils écrite (`docs/FICHE-TECHNIQUE.md`) — 22/09/2026
- [x] Journal Snack : colonnes client, vendeur, part vendeur et part hôtel ajoutées en F à I (vides tant que l'appli ne les envoie pas — migration `20260921200000` de KasbahCalendar) — 21/09/2026
- [x] Boissons dans leur propre onglet — 20/09/2026
- [x] Écrire une Fiche repas avec le prix coûtant de chaque ingrédient et sandwich, la recette et le prix de vente de chaque sandwich — 18/09/2026
- [x] Connecter la Fiche repas à l'appli KasbahCalendar pour permettre à l'équipe d'acheter les ingrédients à prix coûtant (dette réglée par une entrée caisse « +X snack pseudo ») — 18/09/2026
- [x] Ajouter le pain panini à la page Snack de l'équipe ; menu « Ajouter à la page Snack de l'équipe » pour les prochains — 18/09/2026
- [x] Compléter la Fiche repas depuis la carte (paninis et burger chameau, menu frites, tajines) — 18/09/2026
