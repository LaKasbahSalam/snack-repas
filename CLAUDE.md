# Snack & Repas — le classeur Fiche repas et son script

Ce dépôt tient la moitié « classeur » du snack de La Kasbah Salam. L'autre
moitié est l'application, dans le dépôt **KasbahCalendar** (voir son
`CLAUDE.md` et son `docs/ARCHITECTURE.md`).

## Ce qu'il y a ici

| Quoi | Où |
|---|---|
| Le script du classeur Fiche repas | `script/` — poussé au classeur avec `clasp push` |
| Les tests du script | `script/tests/` — tournent ici avec Node, jamais poussés au classeur |
| La carte imprimée, les visuels, les exports | `Snacks and Drinks.dc.html`, `images/`, `*.pdf` |
| Une copie du classeur | `Fiche repas.xlsx` — copie figée, le classeur vivant est sur Google Drive |
| Les tâches | `TASKS.md` |

## Le script tourne chez Google, pas ici

`script/` est relié au classeur par `.clasp.json`. **La version qui tourne
est celle du classeur**, pas celle de ce dossier : les deux divergent en
silence si on modifie l'une sans l'autre.

```bash
cd script
clasp pull            # récupérer ce que le classeur a vraiment
clasp push --force    # envoyer ce dossier au classeur
clasp status          # ce qui partirait, ce qui est ignoré
```

Avant un `clasp push`, faire un `clasp pull` dans un dossier à part et
comparer : si quelqu'un a modifié le script depuis l'éditeur Apps Script,
le push l'écrase sans avertir.

`.claspignore` garde `script/tests/` hors du classeur. Apps Script n'en a
que faire, et ces fichiers utiliseraient inutilement son quota.

## Les tests, à lancer avant de pousser

```bash
cd script
node tests/carte.test.js      # ce que lireCarte_() envoie à l'appli
node tests/journal.test.js    # ce que tirerVentesSnack_() écrit dans le journal
```

`tests/faux-sheets.js` est un faux Google Sheets : une grille de valeurs et
les quelques méthodes que le code appelle. Ça permet de voir ce qu'un script
écrit **avant** de l'envoyer sur le classeur qui fait tourner le snack en
vrai. Les cas qui tournent mal comptent autant que le cas normal : une vente
accusée mais non écrite est perdue pour toujours.

Ce n'est pas un vrai Sheets — pas de formules recalculées, pas de fuseau
horaire, pas de quota. Un test vert ne dispense pas d'un essai réel après le
push.

## Les deux sens entre le classeur et l'appli

Tout passe par une seule Edge Function, `import-prix-snack` :

- **Le classeur envoie** les prix coûtants des ingrédients, et la carte de
  vente (onglet « Carte appli ») avec le prix de revient et la **retenue** de
  chaque article — c'est elle qui décide de la prime du vendeur : 5 DH par
  défaut, 1 DH sur les boissons.
- **Le classeur vient chercher** les ventes faites dans l'appli et les écrit
  dans l'onglet « Journal Snack », puis accuse réception.

L'appli n'écrit **jamais** dans le classeur : pas de compte de service
Google, pas de clé privée à protéger. Le classeur demande, l'appli répond.

Quand une information nouvelle doit circuler, l'ordre compte : **la base de
données et l'Edge Function d'abord, ce script ensuite.** Un script qui envoie
une colonne que la base ne connaît pas fait échouer tout l'import des prix.

## Le secret

`PRIX_SNACK_SECRET` vit dans les propriétés du script (menu Snack →
Configurer l'envoi à l'appli) et doit valoir la même chose que
`IMPORT_PRIX_SNACK_SECRET` côté Supabase. Il n'est écrit dans aucun fichier
de ce dépôt, et n'a pas à l'être.
