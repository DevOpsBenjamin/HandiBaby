# Tournoi baby-foot

Document de cadrage. Il contient les règles du tournoi, telles qu'elles doivent être annoncées aux
participants avant le premier match, et les prévisions techniques de l'application qui tiendra les
scores. Rien n'est développé à ce stade.

---

# Partie 1. Règles du tournoi

## Vue d'ensemble

Trois ou quatre équipes de deux joueurs s'affrontent en toutes-rondes, chaque affrontement explorant
toutes les répartitions de postes possibles. Un playoff à système Page départage ensuite le haut du
classement. Le tournoi n'est pas conçu pour tenir dans un après-midi : il se joue par blocs, au fil
des sessions disponibles.

## Composition

Le vivier de joueurs est permanent. Chaque édition y puise les présents et les répartit en paires
**valables pour cette édition uniquement**. Mélanger les binômes d'une édition à l'autre est
volontaire : c'est la seule façon de mesurer un joueur plutôt qu'une paire, point développé plus
bas.

Le nombre d'équipes est plafonné à quatre. Au-delà, le volume de matchs devient déraisonnable :
cinq équipes produiraient dix affrontements, donc quarante matchs de classement.

## Le duel, unité du tournoi

Chaque équipe a deux façons de se placer : l'un de ses joueurs tient la défense, l'autre l'attaque,
et ils peuvent permuter. Deux équipes qui s'affrontent explorent donc les **deux fois deux
combinaisons possibles**, soit quatre matchs. C'est ce qu'on appelle ici un **duel**.

Notation : `P1/P2` désigne P1 en défense et P2 en attaque.

Duel entre l'équipe X (joueurs P1 et P2) et l'équipe Y (joueurs Q1 et Q2) :

```
        RENCONTRE            EQUIPE X   EQUIPE Y
  1     P1/P2  vs  Q1/Q2       nord       sud
  2     P1/P2  vs  Q2/Q1       sud        nord
  3     P2/P1  vs  Q2/Q1       nord       sud
  4     P2/P1  vs  Q1/Q2       sud        nord
```

Deux règles se lisent dans ce tableau. D'un match au suivant, **une seule des deux équipes permute**
en interne, l'autre garde ses postes. Et **tout le monde change de bout de table à chaque match**.

Le changement de bout systématique est le prix de l'équité, et il est assumé : sur un baby de bureau,
les deux bouts ne sont jamais équivalents, ne serait-ce qu'à cause de l'éclairage, du sol ou d'une
barre qui accroche.

## Équilibre garanti

Le motif du duel a été construit pour que trois équilibres soient tenus **à l'intérieur de chaque
duel**, et donc automatiquement tenus quel que soit le nombre d'équipes et quel que soit l'ordre
dans lequel les duels sont joués :

| Équilibre | Vérification sur un duel |
|---|---|
| Chaque équipe joue autant de matchs à chaque bout | 2 nord, 2 sud |
| Chaque joueur joue autant de matchs à chaque poste | 2 en défense, 2 en attaque |
| Chaque configuration est jouée autant de fois à chaque bout | 1 nord, 1 sud |

Le troisième est le moins évident et le plus important. Sans lui, une configuration serait
systématiquement jouée du même côté de la table, et la statistique « quelle est notre meilleure
configuration » mesurerait en partie le bout de table. Or cette statistique décide de la composition
des équipes en playoff : le biais se propagerait jusqu'au vainqueur du tournoi.

## Le match et le score

Un match se joue **en dix buts**. Le vainqueur est donc toujours à dix, et la saisie se réduit au
**score du perdant**, de zéro à neuf, plus le camp vainqueur.

## Classement

Trois points par victoire, rien pour une défaite.

Départage de deux équipes à égalité, dans cet ordre strict :

1. Nombre de points
2. Bilan du duel direct, en victoires et défaites sur les quatre matchs les ayant opposées
3. Différence de buts sur ces quatre matchs
4. Différence de buts générale
5. Match de barrage, configurations tirées au sort

Le duel direct passe avant la différence de buts générale, et c'est délibéré : dans un groupe
restreint, « on vous a battus trois à un » est l'argument le plus légitime et le moins contestable
qui existe. Contrairement à un tournoi classique, il porte ici sur quatre matchs et non sur un seul,
donc il n'est pas un coup de dés.

Si les trois équipes finissent à égalité de points et que la différence de buts générale ne sépare
personne, cas résiduel et improbable, l'application le signale et l'arbitrage revient aux
organisateurs. Coder un barrage à trois pour ce cas serait du gâchis.

## Playoff, système Page

Le playoff ne récompense pas seulement l'accès, il récompense le rang : **le haut du classement
achète une seconde vie**. Le premier et le deuxième peuvent perdre une fois et gagner le tournoi
quand même. Les autres sortent à leur première défaite.

```
                      TROIS EQUIPES                     QUATRE EQUIPES

QUALIFICATION         1er vs 2e                         1er vs 2e
                      vainqueur -> finale               vainqueur -> finale
                      perdant   -> demie                perdant   -> demie

ELIMINATOIRE          (pas de tour eliminatoire)        3e vs 4e
                                                        vainqueur -> demie
                                                        perdant   -> elimine

DEMIE                 perdant(Q) vs 3e                  perdant(Q) vs vainqueur(E)
                      vainqueur -> finale               vainqueur -> finale

FINALE                vainqueur(Q) vs vainqueur(D)      vainqueur(Q) vs vainqueur(D)

                      3 matchs                          4 matchs
```

Le format est le même dans les deux cas : le tour éliminatoire n'apparaît que le jour où il y a un
quatrième. Une seule règle à retenir.

Ce n'est pas une invention maison. C'est le système des finales du curling et du football
australien, retenu là-bas pour exactement cette raison : faire peser le classement sans priver
personne de match.

**Configuration en playoff.** Chaque équipe joue sa **meilleure configuration**, déterminée par ses
résultats de la phase de classement et affichée avant le premier match de playoff, pour que
personne n'ait à en discuter le moment venu. La comparaison se fait sur les victoires d'abord, puis
sur la différence de buts. Si les deux configurations d'une équipe sont rigoureusement à égalité,
cette équipe tranche elle-même : elle est la seule concernée.

**Choix du bout.** Le mieux classé des deux adversaires choisit son bout de table, à chaque tour.
Sur toute la durée du tournoi, le classement est le seul distributeur de privilèges.

**Gel des données.** Les matchs de playoff n'alimentent ni le classement, ni les configurations, ni
les trophées. Tout est figé à la fin de la phase de classement. Sans ce gel, la configuration
utilisée en playoff serait calculée sur des données incluant le playoff lui-même.

Le playoff reste **verrouillé jusqu'à ce que tous les matchs de classement soient saisis**.

## Déroulement pratique

L'unité de planification est le **duel**, pas le match. La raison est physique : un duel concerne
quatre joueurs nommés, il ne peut se jouer que quand ces quatre personnes sont autour de la table.

Les duels se jouent donc **dans l'ordre que vous voulez**, mais **chacun d'un bloc**, ses quatre
matchs à la suite. C'est ce qui permet d'étaler le tournoi sur plusieurs sessions sans jamais
bloquer la file : quatre personnes se croisent, elles consultent la liste des duels restants, elles
voient le leur, elles y vont.

L'écran d'accueil affiche l'avancement sous cette forme : trois duels sur six joués, et la liste
nominative de ce qui reste.

## Volumétrie

| Équipes | Duels | Matchs de classement | Par équipe | Par joueur | Par configuration | Playoff | Total | Durée de jeu |
|---|---|---|---|---|---|---|---|---|
| 3 | 3 | 12 | 8 | 8 (4 par poste) | 4 | 3 | **15** | environ 2 h |
| 4 | 6 | 24 | 12 | 12 (6 par poste) | 6 | 4 | **28** | environ 3 h 45 |

Estimation sur une base de huit minutes par match, rotations comprises. À quatre équipes, c'est cinq
ou six pauses déjeuner, ou deux grosses sessions. L'engagement est réel, autant le savoir avant de
lancer une édition.

Le passage de trois à quatre équipes double presque le volume, mais il double aussi l'échantillon :
douze matchs par joueur au lieu de huit, six par configuration au lieu de quatre. Les statistiques
y gagnent autant que le calendrier y perd.

## Trophées et statistiques

Affichés à deux échelles : l'édition en cours, et le cumul de toutes les éditions.

| Distinction | Calcul |
|---|---|
| Classement | Points, puis la cascade de départage |
| Meilleure configuration par équipe | Victoires puis différence de buts, par configuration |
| Meilleur défenseur | Moyenne de buts encaissés sur les matchs tenus en défense, la plus basse |
| Meilleur attaquant | Moyenne de buts marqués sur les matchs tenus en attaque, la plus haute |

## Ce que le format ne mesure pas

Cette section existe pour que les trophées ne soient jamais contestés sur un malentendu.

**Le score en dix buts limite l'information disponible.** Le vainqueur marque toujours dix. « Buts
marqués » est donc presque équivalent à « nombre de victoires », et « buts encaissés » à « nombre de
défaites ». La seule information supplémentaire contenue dans un score est la **marge**.

**Sur une seule édition, un joueur n'est pas mesurable.** Les matchs où P1 tient la défense sont
exactement ceux où P2 tient l'attaque : c'est mécanique, la paire permute en bloc. Aucune donnée ne
permet donc de distinguer « P1 a bien défendu » de « P2 a bien attaqué ». Les trophées d'une édition
décrivent une paire dans une configuration, pas un individu. À l'échelle d'une édition, ils sont à
prendre au second degré.

**Le mélange des binômes est ce qui rend le cumul crédible.** Le jour où P1 joue avec Q1, puis avec
Q2, puis avec un autre, sa performance en défense est observée avec des attaquants différents, et
son effet propre devient identifiable. Le cumul de toutes les éditions est donc la seule échelle où
« meilleur défenseur » désigne réellement quelqu'un.

**Avec six joueurs, une saison boucle en cinq éditions.** Il existe exactement cinq façons
d'enchaîner les répartitions pour que chaque joueur ait été le binôme de chacun des cinq autres une
fois et une seule. Au bout de ces cinq éditions, chaque joueur a joué quarante matchs, vingt à
chaque poste, avec cinq partenaires différents. C'est le calendrier qui rend un classement
individuel incontestable, et il ne coûte rien de plus que de choisir les paires dans le bon ordre.

---

# Partie 2. Prévisions techniques

## Principes

Une page web autonome, hébergée en statique, adossée à Supabase pour la persistance. Lecture
publique par le lien, écriture réservée à l'organisateur. Le lien se colle dans Teams et sert de
tableau d'affichage consultable pendant toute la durée du tournoi.

Trois contraintes ont façonné les choix ci-dessous. Le tournoi s'étale sur des semaines, donc la
page est un tableau de bord persistant, pas un direct. Les spectateurs l'ouvrent depuis Teams, dont
la vue web suspend agressivement les onglets en arrière-plan. Et la clé publique de Supabase est,
par conception, lisible dans le code de la page : toute protection écrite côté client serait du
théâtre.

## Modèle de données

```
players
  id, prenom, actif

tournaments
  id, libelle, date_debut, nb_equipes, statut        -- classement | playoff | termine

teams
  id, tournament_id, libelle, joueur_1, joueur_2     -- l'ordre ici ne signifie rien,
                                                     -- les postes sont definis match par match

matches
  id, tournament_id
  phase                     -- classement | qualification | eliminatoire | demie | finale | barrage
  duel                      -- regroupe les 4 matchs d'un meme affrontement, nul hors classement
  rang_dans_duel            -- 1 a 4
  equipe_nord, equipe_sud
  nord_defense, nord_attaque
  sud_defense, sud_attaque
  vainqueur                 -- nul tant que le match n'est pas joue
  score_perdant             -- 0 a 9, nul tant que le match n'est pas joue
  saisi_le
```

Deux décisions portent tout le reste.

**Les quatre postes sont stockés explicitement à chaque match.** C'est ce qui rend toute statistique
future calculable par simple agrégation, y compris celles auxquelles personne n'a encore pensé, et
ce qui rend le calendrier entièrement lisible en base, bouts de table compris.

**Le calendrier est intégralement pré-généré à la création de l'édition**, configurations et bouts
assignés. L'application ne fait ensuite que remplir des scores. Les équilibres décrits en partie 1
sont donc garantis par construction, indépendamment de l'ordre dans lequel les matchs sont
effectivement joués et saisis.

Rien d'autre n'est stocké. Classement, meilleure configuration, trophées et qualification en
playoff sont tous dérivés de ces quelques lignes.

## Droits et sécurité

RLS active sur toutes les tables. Le rôle `anon` dispose du `SELECT` et de rien d'autre : aucune
politique d'écriture ne lui est accordée.

Toute écriture passe par une fonction Postgres en `SECURITY DEFINER`, déclarée avec
`search_path = ''` et chaque table qualifiée par son schéma, conformément à la recommandation de
Supabase. La fonction reçoit la phrase de passe, la vérifie, écrit ou refuse. Une fonction par
opération : enregistrer un score, créer une édition, composer les équipes.

La phrase de passe est stockée hors de portée d'`anon`, dans une table sans politique de lecture ou
dans Supabase Vault, et hachée avec `pgcrypto`.

**La phrase doit faire au moins douze caractères.** C'est une exigence, pas une suggestion : en
renonçant à Supabase Auth, on renonce à sa protection contre la force brute, et une fonction RPC
maison n'en a aucune. Un code à quatre chiffres serait cassé en quelques minutes. Une phrase de
douze caractères rend la question sans objet.

Supabase Auth a été écarté délibérément malgré ses avantages. Le modèle reposerait sur une case à
cocher, « Allow new users to sign up », dont l'oubli ouvre la base en écriture à quiconque ouvre les
outils de développement, **sans produire le moindre signal**. Un mode de défaillance silencieux et
total vaut moins qu'une fonction de dix lignes relisible.

## Rafraîchissement

Relecture complète toutes les cinq secondes. Pas de websocket.

La raison n'est pas la simplicité mais la justesse : une connexion temps réel qui se coupe fait
perdre les événements survenus pendant la coupure, et l'état affiché devient faux silencieusement.
Il faudrait donc de toute façon relire l'intégralité des données à chaque reconnexion, c'est-à-dire
réimplémenter le rafraîchissement périodique en secours. Or Teams sur mobile suspend les onglets dès
qu'on range son téléphone : les coupures seraient la norme, pas le cas limite. Chaque cycle relit la
vérité, il n'y a aucun état à réconcilier.

Cinq secondes de latence sur un tournoi qui dure trois semaines ne se remarquent pas. Si le besoin
apparaît, le temps réel se pose par-dessus comme optimisation, sans rien casser.

## Code

Un fichier HTML autonome, JavaScript sans framework ni chaîne de build. Un déploiement par
glisser-déposer ne justifie pas d'outillage.

Deux blocs sont des fonctions pures, et ce sont eux qui méritent d'être écrits et vérifiés en
premier, avant toute interface :

- **Le générateur de calendrier**, qui prend les équipes et rend la liste complète des matchs. Ses
  invariants sont énonçables, donc vérifiables : bouts équilibrés par équipe et par configuration,
  postes équilibrés par joueur.
- **La cascade de départage**, dont les cinq niveaux et les cas d'égalité sont exactement le genre
  de règle qui se code de travers sans qu'on s'en aperçoive.

Le reste, classement, configurations et trophées, se calcule côté client à partir des lignes de
`matches`. Des vues SQL pour agréger vingt-huit lignes seraient de la cérémonie, et les règles sont
plus lisibles et plus testables en JavaScript.

## Hébergement

Netlify Drop, par glisser-déposer, pour une URL en HTTPS immédiate sans aucune configuration. Azure
Static Web Apps si l'on préfère rester dans l'écosystème Azure DevOps déjà en place. Le choix ne
change pas une ligne de code.

La page ne peut pas être publiée comme artifact Claude : les artifacts s'exécutent derrière une
politique de sécurité stricte qui bloque tout appel réseau sortant, donc tout accès à Supabase.

## Compte Supabase

Le palier gratuit donne droit à **deux projets actifs**, et les projets en pause **ne comptent pas
dans le quota**. Un compte disposant d'un projet actif et d'un projet en sommeil a donc un
emplacement libre. À l'intérieur d'une organisation, le quota est calculé sur l'ensemble des membres
propriétaires ou administrateurs : créer une seconde organisation gratuite ne double pas le droit.
Un compte lié à une autre identité est en revanche un utilisateur distinct, avec son propre quota.

## À faire hors développement

- Créer le projet Supabase et récupérer son URL et sa clé publique
- Choisir la phrase de passe et la poser en base, sans la faire circuler
- Renseigner le vivier de joueurs

## Choix écartés

Consignés pour ne pas les rouvrir sans raison nouvelle.

| Écarté | Motif |
|---|---|
| Élimination directe à trois équipes | Impose un bye : une équipe arriverait en finale après un seul match quand les autres en jouent deux |
| Duel raccourci à deux matchs | Supprime la moitié des observations de poste, alors que c'est précisément ce qu'on veut mesurer |
| Format ouvert au-delà de quatre équipes | Cinq équipes produisent dix duels, soit quarante matchs de classement |
| Bracket classique 1-4 et 2-3 | Réduit douze matchs de classement à un tirage de tête de série, effaçables en un match |
| Finale systématique entre les deux premiers | Rendrait la phase de classement décorative |
| Finale conditionnée à un écart de points | Un seuil se conteste, et une règle décidée après avoir vu le classement est une négociation |
| Supabase Auth | Mode de défaillance silencieux et total en cas d'oubli du réglage d'inscription |
| Temps réel | Perte silencieuse d'événements à la reconnexion, et suspension des onglets par Teams |
| Journal des saisies en ajout seul | Sans objet avec un rédacteur unique |
| Saisie des buts par joueur | Refusée, au prix d'une mesure individuelle impossible sur une édition unique |
