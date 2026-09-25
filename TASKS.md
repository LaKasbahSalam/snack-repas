# Lancement du Snack

## À venir
- [ ] Reporter dans le classeur Gestion de stock les formats et prix notés dans la liste de courses (Claude peut les relire dans la base de l'artefact)
- [ ] **Comptage des stocks** — suivre ce qui est acheté, vendu et consommé par l'équipe (les achats équipe sont déjà marqués `origine = 'equipe'` dans l'appli pour pouvoir les isoler)

## En cours
- [ ] **Commission de 20 % : mettre en service** — une fois la migration `20260925100000` passée dans la base de l'appli : `clasp pull` dans un dossier à part et comparer, `clasp push --force`, une vente test (H du Journal Snack = prime affichée dans l'appli), puis supprimer la colonne H « Retenue » de l'onglet « Carte appli », qui n'est plus lue
- [ ] **Page de ventes du snack dans l'appli KasbahCalendar** — onglet « Journal » de la page Snack écrit le 21/09/2026 (KasbahCalendar, non commité), reste à livrer et à vérifier connecté
- [ ] Tenir à jour `docs/FICHE-TECHNIQUE.md` : ce que fait chaque bouton des quatre outils, et ce qu'il reste à coder (à relire à chaque nouveau bouton)
- [ ] Compléter la Fiche repas : prix d'achat des nouveaux ingrédients et des boissons, quantités en jaune (tajines, fromage…), prix à aligner sur la carte
- [ ] Proposer les boissons à l'équipe à 6 DH : onglet « Boissons », sélectionner les lignes, menu Snack → « Ajouter à la page Snack de l'équipe » (le script pose le code et le prix équipe)

## Fait
- [x] Prime du vendeur : 80 % du bénéfice, l'hôtel en garde 20 % (au lieu de la retenue en DH). Journal Snack : colonnes J Cout, K Benefice, L Commission hotel ; H et I deviennent des formules sur ces cases pour les nouvelles ventes. La Carte appli n'envoie plus de retenue. Script prêt, pas encore poussé au classeur — 25/09/2026
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
