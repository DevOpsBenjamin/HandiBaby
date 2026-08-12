# HandiBaby

HandiBaby est un mini-projet web destiné à gérer et suivre un tournoi de baby-foot inter-équipes.

## Présentation du tournoi

Ce tournoi réunit **3 équipes de 2 joueurs** qui s'affrontent amicalement.

Les règles complètes et le modèle de données sont dans [RULES.BABY.MD](./RULES.BABY.MD).

## Stack

PWA offline-first : Vue 3 + TypeScript, Vite, Tailwind CSS v4, Pinia, Vue Router,
IndexedDB via Dexie, et Supabase **optionnel** pour la synchronisation.

Sans Supabase configuré, l'application tourne entièrement en local sur IndexedDB.

## Démarrer

```bash
npm install
cp .env.example .env.local   # facultatif, laisser vide pour du 100 % local
npm run dev
```

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Vérification des types puis build de production |
| `npm run test:unit` | Tests unitaires (Vitest) |
| `npm run lint` | oxlint puis ESLint |
| `npm run format` | Prettier sur `src/` |

Le service worker n'est actif qu'en build de production : utiliser
`npm run build && npm run preview` pour tester le mode hors ligne.

## Déploiement

Le déploiement est assuré par l'intégration Git de **Cloudflare Pages**, qui build
et publie chaque push sur `main` vers <https://handibaby.pages.dev>.

GitHub Actions (`.github/workflows/build.yml`) ne déploie rien : c'est une CI de
garde-fou (lint, tests unitaires, build) sur les PRs et sur `main`.

Les variables Supabase se renseignent donc dans les **variables d'environnement
du projet Cloudflare Pages**, pas dans les secrets GitHub :

| Variable | Rôle |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase (facultatif) |
| `VITE_SUPABASE_ANON_KEY` | Clé anon Supabase (facultatif) |

Sans elles le bundle se construit quand même et l'application reste en local
uniquement.

## Architecture

```
src/
  core/            infrastructure, sans dépendance à Vue
    db/            base Dexie (source de vérité locale) + outbox de synchro
    supabase/      lecture de la configuration et client optionnel
    sync/          moteur de synchro, registre d'adaptateurs, contrats
    network/       surveillance de la connectivité
    container.ts   racine de composition (instances uniques)
  stores/          façades Pinia réactives au-dessus de core/
  components/      composants d'interface partagés
  views/           écrans routés
```

### Ajouter une fonctionnalité

1. Déclarer ses tables dans `HandiBabyDatabase` (nouvelle version Dexie).
2. Écrire un `SyncAdapter` : `pull` lit Supabase vers IndexedDB, `push` rejoue une
   écriture locale via une fonction RPC `SECURITY DEFINER`.
3. L'enregistrer dans le `SyncRegistry` au démarrage.
4. Écrire dans IndexedDB puis appeler `syncEngine.enqueue(...)` — le moteur se
   charge du reste (reconnexion, file d'attente, nouvelle tentative).

Une écriture qui échoue reste dans l'outbox et interrompt la file : l'ordre des
saisies est préservé et rien n'est perdu silencieusement.
