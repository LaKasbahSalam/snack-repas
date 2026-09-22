# Fiche technique — les outils de La Kasbah Salam

À jour du 20/09/2026. Ce document dit **ce que fait chaque bouton**, **ce qu'un
gestionnaire veut en faire, pas à pas**, **quelles pièces techniques cela met en
marche**, et **ce qu'il reste à écrire** quand le bouton n'existe pas encore.

À relire — et à corriger — chaque fois qu'un bouton est ajouté.

---

# Partie 0 — Avant de toucher à quoi que ce soit

## Les quatre outils

| Outil | Ce que c'est | Où vit le code |
|---|---|---|
| **Fiche repas** | Classeur Google Sheets : coût de revient, carte, page Snack de l'équipe | `Snack & Repas/script/` (Apps Script) |
| **Exercices_version_16** (« la V16 ») | Classeur Google Sheets : caisse, banque, compte de résultat, bilan | `Tresorerie/Script/` (Apps Script) + `Tresorerie/data/` (Python) |
| **KasbahCalendar** | L'application : séjours, extras, ventes du snack, page Snack de l'équipe | `KasbahCalendar/` (Lovable + Supabase `tggdwwvdlrgncbntxkfs`) |
| **Kasbah Analytique** | La base d'analyse et le tableau de bord Looker Studio | `Kasbah-Analytique/` (Supabase `sebwcxxoxpfbliypzokp`) |

## Le sens des flux — qui demande, qui répond

```
   Fiche repas ──── prix coûtants + carte de vente ────▶ KasbahCalendar
        ▲                                                     │
        └──────────── ventes du snack (tirage) ───────────────┘

   Exercices V16 ◀──── caisse classée (tirage) ──────── KasbahCalendar
        │
        └──── compte de résultat + soldes ────▶ Kasbah Analytique ──▶ Looker Studio
```

**Un seul principe, et il protège tout : ce sont les classeurs qui demandent.**
L'appli ne sait pas écrire dans un classeur, et c'est voulu — pas de compte de
service Google, pas de clé privée à garder, et rien qui puisse écraser une
feuille pendant que vous travaillez dedans.

Conséquence de tous les jours : **une correction faite à la main dans un
classeur n'est jamais écrasée.** Les scripts n'écrivent qu'en bas des journaux,
ou dans les colonnes qu'ils ont créées eux-mêmes.

## Le train de nuit

| Heure (Maroc) | Ce qui part tout seul | Déclenché par |
|---|---|---|
| 20h00 | La V16 tire la caisse classée et relève son solde | `syncCloture` (V16) |
| 21h–22h | Rappel Telegram du soir | Edge Function `rappel-soir` |
| 22h00 | La V16 pousse le compte de résultat et les soldes vers Analytique | `exporterCdr` (V16) |
| 22h30 | La Fiche repas envoie prix + carte, et tire les ventes du snack | `envoyerPrixAppliSoir` (Fiche repas) |
| 23h25 / 23h30 | Analytique recopie Beds24, puis la base de l'appli | `sync-beds24`, `sync-kasbah` |

**Évitez de travailler dans un classeur entre 20h et 23h30.** Rien ne sera
écrasé, mais un passage automatique peut tomber au milieu d'une feuille à
moitié remplie et s'arrêter sur une erreur que personne ne verra avant le
lendemain.

## Vos droits, outil par outil

### Fiche repas — libre, sans rien demander

- Renommer un ingrédient, un produit, une boisson, un article de la carte.
- Changer un prix d'achat, une quantité, un prix de vente, une retenue.
- Ajouter une ligne ou une colonne (par le menu de préférence, à la main sinon).
- Réordonner les lignes, mettre des couleurs, écrire des notes.

### Fiche repas — à ne jamais faire

| Le geste | Ce qui casse |
|---|---|
| Taper un code à la main dans « Code équipe » | Un code mal écrit (majuscule, accent, espace, tiret) ou déjà pris fait échouer **tout** l'envoi : prix, carte et passage de 22h30 compris |
| Changer un code déjà envoyé | L'appli croit à un produit nouveau ; l'ancien disparaît de la page Snack et ce qui y était rattaché ne suit pas |
| Laisser un code sur une ligne sans aucun prix | Même effet : l'envoi entier est refusé, rien ne part |
| Déplacer les colonnes A, B, C de l'onglet « Boissons » | Nom, prix d'achat et prix de vente y sont lus **à leur place**, pas à leur titre |
| Déplacer la colonne E (Prix/unité) de « Cout par item » | Même raison |
| Supprimer ou renommer un onglet (`Cout par item`, `Boissons`, `Carte appli`, `Journal Snack`) | Les scripts cherchent le nom exact et s'arrêtent |
| Réécrire une ligne déjà posée du « Journal Snack » | C'est une pièce comptable ; le script n'y touche plus, mais une ligne effacée ne revient pas |

### Exercices V16 — à ne jamais faire

| Le geste | Ce qui casse |
|---|---|
| Écrire à la main dans les colonnes A à H de « Caisse » | C'est la zone de la synchro ; elle se repère à la dernière ligne portant un code en colonne A |
| Ajouter une ligne de caisse sans la formule en H (`=H(n-1)+D(n)`) | Le solde cumulé décroche à partir de cette ligne |
| Écrire dans les colonnes I et J | Réservées au comptage manuel ; le script ne les écrit pas |
| Mettre en colonne E une catégorie absente de la liste déroulante | La synchro refuse d'écrire **le lot entier**, et le dit |
| Écrire une formule avec des virgules | Classeur en français : Google attend des `;` et rejette la formule |
| Renommer l'onglet ` Saisies CB Karim` (l'espace du début compte) | Les formules du CdR et le script ne le trouvent plus |
| Changer le titre d'un onglet de compte de résultat | L'envoi de 22h reconnaît les onglets dont A1 commence par `COMPTE DE RÉSULTAT — EXERCICE` |
| Renommer un poste du CdR (colonne A) | Analytique associe les postes **par libellé** ; un libellé changé est signalé, mais n'est plus compté |
| Déplacer `Caisse!L1` ou `Banque!K1` | Ce sont les soldes officiels lus chaque soir |

### KasbahCalendar — à ne jamais faire

- Appliquer une modification de base sans l'avoir passée au banc d'essai (`supabase/migrations/tests/`). La leçon du 20/09/2026 : deux migrations relues mais jamais exécutées ont empêché **toute vente du snack** pendant une journée.
- Mettre une migration analytique dans ce dépôt : Lovable le surveille et pourrait l'appliquer à la production.
- Corriger `src/integrations/supabase/types.ts` à la main : Lovable le regénère depuis la base.

### Kasbah Analytique — à ne jamais faire

- Recalculer l'argent depuis les journaux : **le CdR de la V16 fait foi**, lu tel quel.
- Additionner les extras et les paiements de la fiche au chiffre d'affaires : ils décrivent ce qui se vend, l'argent se compte dans la V16.
- Sortir une donnée client des schémas `clients` et `kasbah_brut` (loi 09-08, déclaration CNDP).

## Avant une opération risquée

**Fichier → Créer une copie**, toujours, avant une correction en masse ou un
script qui écrit beaucoup. C'est votre comptabilité et votre carte. L'autre
recours est l'historique des versions Google, qui restaure **tout** le
document — y compris ce que vous vouliez garder.

---

# Partie 1 — Fiche repas (le classeur du snack)

## Les onglets

| Onglet | À quoi il sert | Qui l'écrit |
|---|---|---|
| **Cout par item** | Un ingrédient par ligne, un produit par colonne : coût de revient, marge, prix conseillé | Vous + le menu Snack |
| **Boissons** | Une boisson par ligne : prix d'achat, prix de vente, code et prix équipe | Vous + le menu Snack |
| **Carte appli** | Ce que l'équipe vend aux clients : rubrique, article, code, retenue | Vous + le menu Snack |
| **Journal Snack** | Une ligne par vente faite dans l'appli | Le script, uniquement en bas |

## Le produit et l'article : la ligne de partage

C'est ce qui rend la feuille déroutante au premier abord, et ce qui explique la
plupart des messages d'erreur.

| | **Cout par item** et **Boissons** | **Carte appli** |
|---|---|---|
| Ce que c'est | Ce que vous achetez, et ce que ça vous coûte | Ce que le client voit sur l'écran de vente |
| Contient des prix ? | **Oui** — prix d'achat, prix de vente, prix équipe | **Non** — elle *désigne* un produit et emprunte ses prix |
| Une ligne (ou colonne) = | Un produit réel : un ingrédient, une boisson | Un article du menu |

L'ardoise ne connaît aucun prix. Elle dit : « l'article Sprite, c'est le produit
Sprite » — et le script va chercher dans « Boissons » combien il coûte et
combien il se vend.

```
   Boissons                          Carte appli
   ┌──────────────────┐              ┌────────────────────┐
   │ A  Sprite        │◀─── nom ─────│ C  Sprite          │
   │ B  4,50 (achat)  │──── coût ───▶│                    │
   │ C  10,00 (vente) │──── prix ───▶│                    │
   │ F  sprite ───────┼──┐           │ F  sprite ─────────┼──┐
   │ G  6,00          │──┼── code ──▶│ H  1,00 (retenue)  │  │ code
   └──────────────────┘  │  équipe   └────────────────────┘  │ carte
                         ▼                                    ▼
                  Page Snack de l'équipe              Écran de vente client
                        6,00 DH                            10,00 DH
```

**Deux chemins indépendants vers l'appli.** Un produit peut prendre l'un,
l'autre, les deux, ou aucun :

- **Code équipe** rempli → il apparaît sur la page Snack de l'équipe, au prix coûtant pour un ingrédient, au **prix équipe** pour une boisson. C'est un achat pour soi, réglé en dette.
- **Une ligne dans « Carte appli »** → il apparaît à la vente client, au **prix de vente**, avec prime pour le vendeur.

### Pourquoi deux onglets plutôt qu'un

- Le nom peut différer : le produit s'appelle `Théière`, le client lit « Théière à partager ».
- Un produit peut couvrir plusieurs articles, ou aucun : « Coca / Hawai » en couvrait deux ; Sprite existe comme produit sans être (encore) sur la carte client.
- La carte porte des choses qui ne sont pas des produits : `menu_frites`, le supplément frites, n'est pas un article vendu seul.

### La symétrie à retenir

| | Relié par | Si vous le changez |
|---|---|---|
| **Produit ↔ Carte appli** | le **nom** | L'envoi s'arrête : « produit introuvable ». Rien n'est parti, on corrige la colonne C et on relance |
| **Classeur ↔ Appli** | le **code** | Rien ne casse dans le classeur, mais l'appli croit à un produit neuf et perd l'ancien |

Autrement dit : **renommer est sans danger tant qu'on corrige la carte ;
changer un code ne produit aucune erreur visible, et c'est ce qui le rend
dangereux.**

Le prix de revient suit le même chemin que le prix : pour une boisson, c'est le
prix d'achat (colonne B) ; pour un plat, la ligne « Coût revient » de « Cout par
item ». C'est lui qui donne la prime du vendeur — prix de vente − coût −
retenue. Un produit sans coût de revient se vend quand même, mais ne rapporte
rien au vendeur, et rien ne le signale au moment de la vente.

## Le menu Snack, bouton par bouton

### Mettre à jour les calculs
- **Ce qu'il fait** : recalcule le bloc sous les ingrédients — coût de revient, marge, coût/prix, prix conseillé — en suivant le nombre réel d'ingrédients et de produits.
- **Ce qu'il ne touche pas** : vos prix de vente et votre objectif de coût. Ils sont mémorisés dans le fichier, pour survivre à une ligne cassée.
- **Quand** : après avoir ajouté des lignes ou des colonnes à la main.

### Ajouter un ingrédient
- Insère une ligne sous le dernier ingrédient, met 0 dans toutes les recettes, recalcule, place le curseur sur le nom.
- À vous : le nom, la quantité achetée (C) et le prix payé (D). Le prix/unité (E) se calcule.

### Ajouter un produit
- Insère une colonne après le dernier produit, met 0 partout, recalcule.
- À vous : le nom en ligne 2, les quantités de la recette, le prix de vente dans le bloc.

### Compléter depuis la carte
- Ajoute les produits et ingrédients de la carte papier (`Snacks and Drinks.dc.html`) qui manquent. Reconnaît ce qui existe déjà par le nom, sans accents ni majuscules : **le relancer n'ajoute rien en double**.
- Une quantité connue par analogie est écrite ; une quantité inconnue reste vide **sur fond jaune** — c'est votre liste de choses à remplir.
- Les écarts de prix avec la carte sont signalés, jamais corrigés d'office.

### Déplacer les boissons dans leur onglet
- Opération faite une fois (20/09/2026) : crée l'onglet « Boissons », y recopie les boissons avec leur prix de vente, puis retire de « Cout par item » leurs colonnes et les ingrédients qui ne servaient qu'à elles.
- **À ne plus relancer.** La liste des six boissons d'origine est figée dans le script (`BOISSONS` dans `script/Boissons.js`) : il rajoute celles qu'il n'y trouve plus. Depuis que « Coca / Hawai » a été scindé en Coca, Hawai et Sprite, le relancer recréerait une ligne « Coca / Hawai ».
- Il ne sert donc plus à reformater : les formules d'une ligne ajoutée à la main se recopient depuis la ligne du dessus.

### Poser les photos des produits
- Pose les photos en ligne 1 au-dessus des colonnes F à J, règle la hauteur de ligne et la largeur des colonnes.
- **Limite connue** : les photos sont posées d'après la **position** de la colonne, pas d'après le produit. Depuis que les boissons ont quitté l'onglet, les colonnes ont glissé : relancez-le et vérifiez à l'œil, ou corrigez la table `PHOTOS` dans `script/Snack.js`.

### Ajouter à la page Snack de l'équipe
Le bouton le plus utilisé. Il travaille sur l'onglet où vous êtes.

- **Depuis « Cout par item »** : la ligne où vous avez cliqué reçoit un code tiré de son nom, unique ; le prix proposé à l'équipe est le **prix coûtant** (colonne E). Le prix est vérifié **avant** d'écrire le code — un code sans prix bloquerait tous les envois suivants.
- **Depuis « Boissons »** : les lignes sélectionnées (plusieurs d'un coup) reçoivent un code et un **prix équipe**, 6 DH par défaut, un autre prix si vous le tapez. Une boisson n'est pas cédée à son prix d'achat.
- Dans les deux cas : confirmation avant d'écrire quoi que ce soit, puis l'envoi part.
- **Ce qui l'arrête** : un prix manquant, un code déjà pris, une ligne vide.

### Créer l'onglet Carte appli
- Crée l'onglet et le pré-remplit d'après la carte papier : rubrique, article, produit de la fiche, cases Sauce et Frites, code, retenue (5 DH, 1 DH sur les boissons).
- La **retenue** est ce que la maison garde avant la prime du vendeur : prime = (prix de vente − coût de revient − retenue) × quantité. Vide = 5 DH.

### Envoyer les prix à l'appli
- Envoie en un seul passage : les prix coûtants des ingrédients codés, les boissons codées à leur prix équipe, et la carte de vente si l'onglet existe. **L'appli remplace toute sa liste** à chaque envoi.
- Au retour, va chercher les ventes du snack et les écrit en bas du « Journal Snack », puis accuse réception. L'accusé part **après** l'écriture et ne porte que sur les lignes réellement écrites : une panne fait recommencer, jamais perdre.
- **Ce qui l'arrête, avant que rien ne parte** : un code mal formé, un code en double, un code sans prix, un article de la carte dont le produit est introuvable ou sans prix de vente, une case Frites cochée sans ligne `menu_frites`, une retenue négative.

### Configurer l'envoi à l'appli
- Enregistre `PRIX_SNACK_SECRET` dans les propriétés du script. Doit valoir exactement `IMPORT_PRIX_SNACK_SECRET` côté Supabase. Il n'est écrit dans aucun fichier du dépôt, et n'a pas à l'être.

### Programmer l'envoi chaque soir
- Pose (ou repose) le déclencheur de 22h30. Un seul, même relancé plusieurs fois.

## Ce qu'un gestionnaire veut faire

### Changer le prix de vente d'un produit
1. « Cout par item », ligne « Prix de vente », taper le nouveau prix.
2. Menu Snack → « Envoyer les prix à l'appli » (ou attendre 22h30).

Ressources : Sheets, `CarteAppli.js`, Edge Function `import-prix-snack`. **Rien à coder.**

### Ajouter un produit à la carte
1. « Ajouter un produit », nom en ligne 2, quantités de la recette, prix de vente.
2. « Carte appli » : une ligne — rubrique, article, nom exact du produit, cases Sauce/Frites, retenue si elle diffère de 5 DH.
3. Le **code** : à taper, en minuscules sans accent (`panini_thon`). C'est le dernier endroit où un code s'écrit encore à la main.
4. Envoyer.

Ressources : Sheets, `Snack.js`, `CarteAppli.js`, `import-prix-snack`.
**Code manquant** : un bouton « Ajouter un article à la carte » qui génère le code comme le fait déjà la page Snack. Une ligne de carte mal codée bloque tout l'envoi — c'est le seul endroit où ça peut encore arriver.

### Retirer un article de la carte

**Attention au piège** : effacer seulement le code ne retire pas l'article, ça
**bloque l'envoi**. Une ligne qui porte un article sans code est refusée
(« code « » : minuscules, chiffres ou _ seulement »). Le script ne saute une
ligne que si **l'article et le code sont vides tous les deux**.

**Définitivement** — supprimer la ligne entière (clic droit → Supprimer la
ligne), puis envoyer. L'appli remplace toute sa carte à chaque envoi :
l'article disparaît de l'écran de vente. Les ventes déjà faites restent dans
« Journal Snack », qui garde un texte, pas une référence.

**Le temps d'une rupture** — effacer **l'article (B) et le code (F)**, et
garder le reste de la ligne. Elle devient invisible pour le script, prête à
être re-remplie. Notez le code dans une colonne libre à droite (à partir de I,
avec n'importe quel titre sauf `Retenue`) : au retour, l'article doit reprendre
**exactement le même**.

**Retirer le produit lui-même** (la boisson ou la colonne de « Cout par item »)
vient **après** : tant qu'une ligne de carte le désigne, l'envoi s'arrête sur
« produit introuvable ». L'ordre est toujours : la carte d'abord, le produit
ensuite.

Deux cas particuliers : `menu_frites` ne peut pas partir tant qu'une case
Frites est cochée quelque part, et supprimer un ingrédient de « Cout par item »
change le coût de revient de tous les produits qui s'en servaient.

**Code manquant** : une colonne « Épuisé » à cocher, qui retire l'article de
l'appli sans toucher ni à l'article ni au code. Réversible en un clic, et sans
code à recopier à la main.

### Mettre un ingrédient à disposition de l'équipe, à prix coûtant
1. « Cout par item », cliquer sur la ligne.
2. Menu Snack → « Ajouter à la page Snack de l'équipe », confirmer.

**Rien à coder.** L'appli, la base et la page Snack sont génériques : rien à changer de leur côté.

### Ajouter une boisson, de bout en bout

Une boisson vit à deux endroits : l'onglet **« Boissons »** (ce qu'elle coûte et
ce qu'elle rapporte) et l'onglet **« Carte appli »** (ce que le client voit).
Les deux sont reliés par **le nom**, pas par un code : la colonne C de la carte
doit retrouver, mot pour mot, un nom de la colonne A de « Boissons ». Accents
et majuscules n'ont pas d'importance, un mot en plus ou en moins, si.

**1. La poser dans l'onglet « Boissons »**
- Une ligne, n'importe où (le bas est le plus simple, l'ordre n'a aucune importance).
- Colonne A : le nom. Colonne B : le prix d'achat, à l'unité. Colonne C : le prix de vente au client.
- Colonnes D et E (Marge, Coût / prix) : **des formules**. Elles ne se recopient pas toutes seules — tirer celles de la ligne du dessus.
- Colonnes F et G (Code équipe, Prix équipe) : **ne rien taper**, le menu s'en charge.

**2. La proposer à l'équipe** — facultatif
- Sélectionner la ou les lignes, menu Snack → « Ajouter à la page Snack de l'équipe ».
- Laisser le prix vide pour 6 DH, ou taper le vôtre. Confirmer.
- Le code s'écrit en « Code équipe », le prix en « Prix équipe », et l'envoi part dans la foulée.
- Pour ne pas la proposer à l'équipe : laisser « Code équipe » vide. La boisson reste dans la feuille, simplement ignorée par l'envoi.

**3. La mettre en vente pour les clients** — facultatif aussi
Onglet « Carte appli », une ligne :

| Col. | Quoi | Exemple |
|---|---|---|
| A | Rubrique | `Boissons` ou `Boissons chaudes` |
| B | Article — le nom vu par le client | `Sprite` |
| C | **Produit de la fiche** — le nom exact de la colonne A de « Boissons » | `Sprite` |
| D, E | Sauce, Frites | décochés |
| F | Code — minuscules, chiffres ou `_`, 2 à 30 signes, jamais utilisé ailleurs dans cette colonne | `sprite` |
| G | Prix envoyé | **laisser vide**, le script l'écrit |
| H | Retenue | `1` pour une boisson |

Ces codes-là sont indépendants de ceux de « Code équipe » : ce sont deux listes
séparées, et le même mot peut servir dans les deux.

**4. Envoyer** — menu Snack → « Envoyer les prix à l'appli ». Le message final
annonce le nombre de produits et d'articles partis.

**Ce qui arrête l'envoi** — et rien ne part tant que ce n'est pas réglé :

| Le message | Ce qu'il faut corriger |
|---|---|
| « produit « X » introuvable » | Le nom en colonne C de la carte ne correspond à aucune ligne de « Boissons » |
| « X n'a pas de prix de vente » | Colonne C de « Boissons » vide |
| « code « » : minuscules, chiffres ou _ seulement » | Une ligne de carte a un article mais pas de code |
| « code « X » utilisé deux fois » | Deux lignes avec le même code dans la même colonne |
| « pas de prix « Prix équipe » ni d'achat en colonne B » | Un code équipe posé sur une ligne sans aucun prix |

Le script s'arrête **au premier problème** : une fois corrigé, le suivant peut
apparaître. C'est normal, il faut relancer jusqu'au message de succès.

### Scinder une boisson existante

Le cas du 20/09/2026 : « Coca / Hawai » est devenu Coca, Hawai et Sprite.

1. Corriger les lignes dans « Boissons » (renommer l'ancienne, ajouter les nouvelles, formules recopiées).
2. **Aller tout de suite dans « Carte appli »** : la ligne qui pointait vers l'ancien nom est maintenant orpheline. Remettre en colonne C un nom qui existe (`Coca`), et en colonne B le nom que le client doit lire.
3. **Ne jamais changer le code** de cette ligne (colonne F) : il est déjà parti dans l'appli.
4. Décider pour les nouvelles : une ligne de carte chacune si elles se vendent à part, rien si l'ancienne ligne les couvre toutes.
5. Envoyer.

Oublier l'étape 2 est ce qui produit le message « produit introuvable » — sans
conséquence, rien n'est parti, mais l'envoi du soir échouera tant que ce n'est
pas corrigé.

### Proposer les boissons à l'équipe à 6 DH
1. Onglet « Boissons », sélectionner les lignes voulues.
2. Menu Snack → « Ajouter à la page Snack de l'équipe », laisser le prix vide pour 6 DH, confirmer.

**Rien à coder** (fait le 20/09/2026). Attention à la bière : 16 DH d'achat pour 6 DH à l'équipe.

### Retirer un produit de la page Snack de l'équipe
1. Effacer son code en « Code équipe ».
2. Envoyer.

**Rien à coder** — mais notez le code effacé : si le produit revient, il doit reprendre **le même**.

### Savoir si un produit est rentable
1. « Cout par item » : coût de revient, marge, coût/prix et prix conseillé sont déjà calculés.
2. L'objectif de coût (35 % par défaut) se change dans le bloc ; « Mettre à jour les calculs » recalcule les prix conseillés.

**Rien à coder.** À surveiller : un coût de revient à 0 signale une recette incomplète, pas un produit gratuit.

### Changer la prime des vendeurs
1. « Carte appli », colonne « Retenue » : plus de retenue = moins de prime.
2. Envoyer.

**Rien à coder.** À savoir : sans coût de revient, l'appli ne donne aucune prime, et rien ne le signale au moment de la vente.

### Savoir ce que l'équipe doit
**C'est dans l'appli, pas dans le classeur** : page Snack, et Admin → onglet
Snack. Une ligne par personne avec ce qu'elle doit, le détail des achats au
clic, et — pour l'admin du snack — la correction d'une quantité ou la
suppression d'une ligne. Le manager voit la même liste en lecture seule.
(`src/components/snack/DettesEquipe.tsx` dans KasbahCalendar.)

Les achats de l'équipe sont marqués `origine = 'equipe'`, et la dette se règle
par une entrée de caisse « +X snack pseudo ».

**Rien à coder.** Une copie dans le classeur n'aurait d'intérêt que pour la
comptabilité — et c'est la V16 qui compte l'argent, pas la Fiche repas.

### Suivre les ventes du jour
1. « Journal Snack » : une ligne par vente, avec le cumul en colonne E.
2. Pour voir la journée en cours sans attendre 22h30 : « Envoyer les prix à l'appli », qui tire les ventes au passage.

**Code manquant** : un bouton « Tirer les ventes » seul, sans renvoyer les prix — l'envoi complet est lourd et inutile quand on veut juste regarder.

### Faire le point sur les stocks
Rien n'existe encore. C'est la tâche « Comptage des stocks » de `TASKS.md`.

**Code à écrire** : un onglet « Stock » (quantité achetée − quantité vendue − quantité prise par l'équipe), alimenté par le Journal Snack et les recettes de « Cout par item ». Le calcul appartient au classeur : l'appli connaît les ventes par article, mais la recette n'existe qu'ici.

### Mettre à jour la carte papier
`Snacks and Drinks.dc.html` et les PDF du dossier ne sont **pas** reliés au classeur : ils se mettent à jour à la main.

**Code manquant** : un bouton « Exporter la carte » qui régénère le HTML depuis « Carte appli ». Sans lui, les trois cartes — papier, appli, classeur — divergent lentement.

### Confier le classeur à quelqu'un
- Partage Google : **Lecteur** par défaut. « Éditeur » donne aussi accès au script et à ses propriétés, donc au secret.
- Le menu Snack n'apparaît que pour qui a le droit d'exécuter le script, et les fenêtres de confirmation s'ouvrent chez la personne qui clique.

---

# Partie 2 — Exercices_version_16 (le classeur comptable)

Le classeur de référence : `1OUsQHnN9J241pLTb3pyrKmj7MTIrjCI6PNAw4FZ835U`. Les
`.xlsx` et les versions antérieures (v9, v12, v15…) qui traînent dans Drive ne
sont plus à jour — **la V16 fait foi**.

## Les onglets qui comptent

| Onglet | À quoi il sert | Qui l'écrit |
|---|---|---|
| **Caisse** | Le journal de caisse. Colonnes A à H écrites par la synchro, H = formule de solde cumulé, **I et J réservées au comptage manuel**, L1 = solde officiel | Le script (A–H) + vous (I, J, L1) |
| **Banque** | Le journal de banque. K1 = solde officiel | Vous |
| ` Saisies CB Karim` | Les dépenses par carte. Colonne G = montant pour le compte de résultat (l'opposé de D) | Vous |
| **COMPTE DE RÉSULTAT — EXERCICE …** | Un onglet par exercice (mars → février). Postes en colonne A, mois en colonnes B et suivantes | Vous + le bouton « Insérer la formule ici » |
| **Bilan**, immobilisations, échéancier | Suivi patrimonial | Vous |

## Les menus, bouton par bouton

### Caisse → Synchroniser maintenant
- **Ce qu'il fait** : demande à l'Edge Function `export-caisse` les lignes classées non encore exportées, les écrit en bas de « Caisse » (A à H), puis accuse réception — **et seulement des lignes réellement écrites**.
- **Un verrou** empêche le clic manuel et le passage de 20h de se marcher dessus : sans lui, deux passages liraient la même file et écriraient les lignes en double.
- **Il vérifie avant d'écrire** : si une catégorie n'est pas dans la liste déroulante de la colonne E, il s'arrête **avant** la première écriture et nomme les catégories fautives. Écrire d'abord et buter ensuite laisserait l'onglet à moitié rempli, sans accusé — et le passage suivant réécrirait tout par-dessus.
- **Il relève ensuite le solde** et le dépose en base. Ce n'est plus lui qui annonce quoi que ce soit dans Telegram : `rappel-soir` lit le dernier solde connu, avec sa date. C'est le découplage qui a réglé la panne du 23 au 27 août 2026, où une synchro en échec faisait disparaître le message du soir.
- **Ce qu'il affiche** : « Rien à ajouter » ou « N ligne(s) ajoutée(s) ».

### CdR → Insérer la formule ici
- **Ce qu'il fait** : pose dans la case sélectionnée la formule qui totalise un poste pour un mois, en additionnant les trois sources — `Caisse!D`, `Banque!C` et ` Saisies CB Karim'!G`.
- Il lit la **catégorie** en colonne A de la même ligne et le **mois** en ligne 2 de la même colonne : exactement ce que font les formules déjà en place. Il n'invente aucune convention.
- **Il relit l'étendue des données au moment où vous cliquez** — c'est tout l'intérêt : les formules posées à la main une fois pour toutes (`Caisse!$D$2:$D$4032`) n'incluront jamais les lignes que la synchro ajoute ensuite. Relancer le bouton sur une case déjà remplie la remet à jour.
- **Il confirme avant d'écrire** : catégorie, mois, cellule, et jusqu'à quelle ligne il cherche dans chaque source.
- **Ce qui l'arrête** : une case de la colonne A (poste, pas montant), un en-tête de colonne qui n'est pas un mois (TOTAL, RÉALISÉ), un onglet source introuvable.
- Aucun filtre de signe : les trois colonnes sources sont déjà au bon signe. Filtrer couperait les corrections et remboursements.

### Analyse → Envoyer le CdR maintenant
- **Ce qu'il fait** : lit **tous** les onglets dont la case A1 commence par `COMPTE DE RÉSULTAT — EXERCICE`, tels quels, et les envoie à l'Edge Function `import-cdr` d'Analytique. Lecture seule : rien n'est écrit dans le classeur.
- Le même envoi porte les **soldes de trésorerie**, lus dans `Caisse!L1` et `Banque!K1`. Le classeur fait foi, rien n'est recalculé. Un solde illisible n'empêche pas l'envoi du CdR — il est juste noté dans les journaux.
- **Ce qui l'arrête** : aucun onglet de CdR reconnu, ou `URL_IMPORT_CDR` / `SECRET_IMPORT_CDR` absents des propriétés du script.

### Les deux boutons invisibles (à lancer depuis l'éditeur Apps Script)
- `installerDeclencheurs` : **supprime tous les déclencheurs**, repose celui de la synchro (20h) et rappelle `installerDeclencheurExportCdr`. À relancer si `HEURE_CLOTURE` change — le déclencheur existant garde l'ancienne heure sinon.
- `installerDeclencheurExportCdr` : ajoute celui de 22h s'il manque, sans toucher aux autres.

## Ce qu'un gestionnaire veut faire

### Voir la caisse à jour maintenant, sans attendre 20h
1. Menu Caisse → « Synchroniser maintenant ».

Ressources : Apps Script `Code.js`, Edge Function `export-caisse`, base de l'appli. **Rien à coder.**

### Débloquer une catégorie refusée
Le message nomme les catégories absentes de la liste déroulante. Deux chemins :
1. Les ajouter à la validation de données de la colonne E de « Caisse » — si la catégorie est légitime ;
2. Ou les corriger côté `classify`, dans l'appli — si c'est le classement qui s'est trompé.

Puis relancer la synchro. **Rien à coder** — mais c'est la panne la plus fréquente, et elle bloque **tout le lot**.

### Ajouter une ligne de caisse à la main
1. L'écrire **sous** la dernière ligne, colonnes B à G.
2. Ne pas mettre de code en colonne A : c'est ce qui repère la fin de la zone synchronisée.
3. Colonne H : recopier la formule de la ligne du dessus (`=H(n-1)+D(n)`), jamais un montant.

**Code manquant** : un bouton « Ajouter une écriture de caisse » qui pose la ligne au bon endroit avec la bonne formule et une catégorie prise dans la liste. Aujourd'hui, la seule protection est cette page.

### Compléter le compte de résultat d'un mois
1. Se placer sur la case (poste en ligne, mois en colonne).
2. Menu CdR → « Insérer la formule ici », vérifier la confirmation, valider.
3. Répéter — ou recopier la formule à la main quand les plages sont encore bonnes.

**Code manquant** : « Remplir toute la colonne du mois » et « Rafraîchir toutes les formules du CdR ». Le second surtout : les plages figées de l'ancien classeur ne voient pas les lignes ajoutées depuis, et un CdR sous-évalué ne se signale pas tout seul.

### Vérifier que le tableau de bord voit les bons chiffres
1. Menu Analyse → « Envoyer le CdR maintenant ».
2. Le message affiché donne le statut et le nombre de montants reçus.
3. Looker Studio rafraîchit ses données toutes les 12 h par défaut.

Ressources : `ExportCdr.js`, `import-cdr`, Supabase analytique, Looker Studio. **Rien à coder.**

### Clôturer un mois
1. Rapprocher la banque et la CB, corriger les classements.
2. Compléter les lignes saisies à la main du CdR : loyer, salaires, électricité étalée, taxe de la ville, amortissements.
3. Relancer les formules du mois (CdR → « Insérer la formule ici » sur les cases concernées).
4. Vérifier `Caisse!L1` et `Banque!K1`.
5. Envoyer le CdR.

**Code manquant** : une case « Mois clôturé » et un contrôle de cohérence (solde théorique contre solde compté) avant l'envoi.

### Corriger une écriture ancienne
- Corriger **dans le classeur**, jamais en supprimant une ligne déjà exportée : la ligne est accusée côté base et ne reviendra pas.
- Si la correction touche un mois déjà envoyé, relancer l'envoi du CdR : Analytique relit tout, il n'y a pas d'historique figé à rattraper.

### Une opération en masse (reclassement, correction de dates)
1. **Créer une copie du classeur.**
2. Écrire le script Python dans `Tresorerie/data/`, en réutilisant le bloc d'authentification de `test_connexion.py`.
3. Le faire d'abord **afficher** ce qu'il compte modifier. Valider. Ensuite seulement écrire.
4. Écrire en une opération groupée, pas cellule par cellule : pas d'état à moitié modifié si le script s'arrête en route.
5. Ne pas le lancer autour de 20h : le verrou du script Apps Script ne connaît pas Python.

L'écriture Python est **immédiate et sans retour possible**.

### Partager le classeur avec le comptable
- **Lecteur** suffit pour lire et exporter. « Éditeur » donne accès au script et à ses propriétés, donc aux deux secrets (`SECRET`, `SECRET_IMPORT_CDR`).
- Pour un envoi ponctuel : Fichier → Télécharger → Excel ou PDF, qui n'emporte ni script ni secret.

---

# Partie 3 — Le code qui reste à écrire

Par ordre d'utilité, tel qu'il ressort des deux parties ci-dessus.

| # | Ce qui manque | Où | Pourquoi maintenant |
|---|---|---|---|
| 1 | Comptage des stocks | Fiche repas, nouvel onglet + recettes | Déjà dans `TASKS.md` ; sans lui, aucune perte n'est visible |
| 2 | Photos des boissons nouvelles (Hawai, Pom's, Sprite) | KasbahCalendar, `src/components/snack/SnackImage.tsx` | Les trois s'affichent sans image sur la page Snack |
| 3 | Bouton « Ajouter un article à la carte » (code généré) | Fiche repas, `CarteAppli.js` | Dernier endroit où un code se tape à la main, et où une faute bloque tout l'envoi |
| 4 | « Rafraîchir toutes les formules du CdR » | V16, `Code.js` | Les plages figées sous-évaluent le CdR en silence |
| 5 | Bouton « Ajouter une écriture de caisse » | V16, `Code.js` | La formule de solde en H est aujourd'hui recopiée à la main |
| 6 | Colonne « Épuisé » sur la carte | Fiche repas, `CarteAppli.js` + appli | Éviter de déplacer un code pour une rupture d'un jour |
| 7 | Bouton « Tirer les ventes » seul | Fiche repas, `Envoi.js` | Regarder la journée sans renvoyer toute la carte |
| 8 | Export de la carte papier depuis « Carte appli » | Fiche repas | Les trois cartes divergent lentement |
| 9 | Contrôle de cohérence avant clôture | V16 | Un écart de caisse se voit aujourd'hui trop tard |
| 10 | Rendre « Déplacer les boissons » inoffensif (liste figée `BOISSONS`) | Fiche repas, `Boissons.js` | Relancé aujourd'hui, il recrée « Coca / Hawai » |
