<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

type TabKey = 'all' | 'out-of-bounds' | 'official' | 'myths' | 'handibaby'

const activeTab = ref<TabKey>('all')
const searchQuery = ref('')

interface OutOfBoundsScenario {
  id: string
  title: string
  subtitle: string
  icon: string
  beneficiary: 'defense' | 'shooter' | 'custom'
  beneficiaryLabel: string
  shortDecision: string
  ruleExplanation: string
  restartLocation: string
  keywords: string[]
}

const scenarios: OutOfBoundsScenario[] = [
  {
    id: 'passive-block',
    title: 'Contre passif (Ricochet défensif)',
    subtitle:
      'L’attaquant tire fort, la balle ricoche sur le défenseur en opposition et sort de la table',
    icon: '🛡️',
    beneficiary: 'defense',
    beneficiaryLabel: 'Aux arrières du défenseur (l’équipe qui subissait le tir)',
    shortDecision: 'Balle au défenseur',
    ruleExplanation:
      'L’attaquant est celui qui a initié l’action volontaire à l’origine de la vitesse et de la trajectoire du tir. Le défenseur n’étant qu’un obstacle passif qui s’interpose, la sortie de balle est imputée au tireur.',
    restartLocation:
      'Aux 2 arrières ou gardien du défenseur, balle arrêtée sous le pied + « Prêt ? »',
    keywords: ['contre', 'passif', 'ricochet', 'defenseur', 'tir', 'sortie', 'rebond', 'bloque'],
  },
  {
    id: 'active-block',
    title: 'Contre actif (Frappe volontaire défensive)',
    subtitle:
      'Le défenseur arme ou tape volontairement dans la balle au moment du contre et l’expulse dehors',
    icon: '⚡',
    beneficiary: 'shooter',
    beneficiaryLabel: 'Aux arrières de l’attaquant (l’équipe adverse du défenseur)',
    shortDecision: 'Balle à l’attaquant',
    ruleExplanation:
      'Le défenseur n’a pas seulement fait opposition : il a imprimé une nouvelle force motrice et une nouvelle direction qui ont directement provoqué l’expulsion de la balle hors de la table.',
    restartLocation:
      'Aux 2 arrières ou gardien de l’attaquant, balle arrêtée sous le pied + « Prêt ? »',
    keywords: ['contre', 'actif', 'frappe', 'defenseur', 'degagement', 'volontaire', 'tape'],
  },
  {
    id: 'direct-miss',
    title: 'Tir direct non dévié hors du terrain',
    subtitle: 'L’attaquant (ou un joueur) frappe et la balle s’envole directement hors de la table',
    icon: '🚀',
    beneficiary: 'defense',
    beneficiaryLabel: 'Aux arrières de l’adversaire',
    shortDecision: 'Balle à l’adversaire',
    ruleExplanation:
      'Le tireur est le seul responsable de la sortie de balle. La remise en jeu revient donc automatiquement à l’équipe adverse.',
    restartLocation: 'Aux 2 arrières ou gardien adverse, balle arrêtée sous le pied + « Prêt ? »',
    keywords: ['direct', 's’envole', 'dehors', 'tireur', 'manque', 'envole'],
  },
  {
    id: 'defense-miss',
    title: 'Dégagement défensif qui sort du terrain',
    subtitle:
      'Le défenseur tire ou dégage depuis ses arrières et la balle sort directement de la table',
    icon: '🧤',
    beneficiary: 'shooter',
    beneficiaryLabel: 'Aux arrières de l’adversaire (l’équipe qui attaquait)',
    shortDecision: 'Balle à l’adversaire',
    ruleExplanation:
      'C’est le défenseur qui a provoqué l’expulsion de la balle en dégageant trop fort ou maladroitement.',
    restartLocation: 'Aux 2 arrières ou gardien adverse, balle arrêtée sous le pied + « Prêt ? »',
    keywords: ['degagement', 'defenseur', 'arriere', 'gardien', 'expulsion'],
  },
  {
    id: 'exterior-bounce',
    title: 'Rebond sur cendrier, rampe ou bord supérieur',
    subtitle:
      'La balle heurte le dessus du meuble en bois, le cendrier ou la rampe lumineuse puis retombe sur le terrain',
    icon: '🪵',
    beneficiary: 'custom',
    beneficiaryLabel: 'Balle déclarée sortie immédiatement',
    shortDecision: 'Balle sortie dès l’impact extérieur',
    ruleExplanation:
      'Dès qu’une balle touche un élément extérieur à la cuve de jeu (dessus des parois, rampe d’éclairage, meuble), elle est immédiatement considérée comme hors du terrain, même si elle retombe sur le tapis ensuite. La remise revient au camp adverse du joueur ayant causé le tir (ou selon règle contre passif/actif).',
    restartLocation: 'Remise aux arrières de l’équipe adverse du responsable du coup',
    keywords: ['cendrier', 'rampe', 'bois', 'meuble', 'rebond', 'eclairage', 'exterieur'],
  },
  {
    id: 'exterior-into-goal',
    title: 'Balle heurtant l’extérieur puis entrant dans la cage',
    subtitle:
      'Un tir saute, touche le dessus du baby ou la rampe, puis redescend directement dans le but',
    icon: '🚫',
    beneficiary: 'custom',
    beneficiaryLabel: 'Pas de but ! (Balle sortie avant l’entrée)',
    shortDecision: 'But refusé',
    ruleExplanation:
      'La balle étant morte dès qu’elle a touché la structure extérieure, le fait qu’elle termine dans le but est nul et non avenu. Aucun point n’est accordé.',
    restartLocation: 'Remise en jeu aux arrières du camp qui a subi le tir (ou défenseur)',
    keywords: ['but', 'exterieur', 'rampe', 'refuse', 'saute', 'annule'],
  },
]

const selectedScenarioId = ref<string>('passive-block')
const selectedScenario = computed<OutOfBoundsScenario>(
  () =>
    filteredScenarios.value.find((s) => s.id === selectedScenarioId.value) ??
    filteredScenarios.value[0] ??
    scenarios[0] ?? {
      id: 'passive-block',
      title: '',
      subtitle: '',
      icon: '',
      beneficiary: 'defense',
      beneficiaryLabel: '',
      shortDecision: '',
      ruleExplanation: '',
      restartLocation: '',
      keywords: [],
    },
)

interface MythItem {
  id: string
  myth: string
  verdict: 'LEGAL' | 'ILLEGAL' | 'NUANCED'
  verdictLabel: string
  officialRule: string
  explanation: string
  keywords: string[]
}

const myths: MythItem[] = [
  {
    id: 'pissette',
    myth: '« La pissette est interdite ! »',
    verdict: 'LEGAL',
    verdictLabel: '100% LÉGALE',
    officialRule: 'Tir parfaitement autorisé en compétition officielle (FFFT & ITSF)',
    explanation:
      'Le tir d’un ailier des avants (pissette droite ou gauche le long de la bande) est totalement autorisé. La légende urbaine vient des parties de bar où certains joueurs frustrés voulaient interdire ce tir difficile à arrêter. En compétition, c’est au défenseur d’anticiper et de fermer son premier poteau !',
    keywords: ['pissette', 'ailier', 'cote', 'bande', 'tir'],
  },
  {
    id: 'demis-goal',
    myth: '« Le but des demis ne compte pas (ou compte double) ! »',
    verdict: 'LEGAL',
    verdictLabel: 'COMPTE POUR 1 BUT',
    officialRule: 'Autorisé dès lors que les deux touches ont été respectées',
    explanation:
      'Un but inscrit directement depuis la barre des demis (5 joueurs) est 100% valable et rapporte 1 point. La seule condition obligatoire est d’avoir fait toucher la balle à au moins 2 figurines de la barre des demis lors de la mise en jeu avant de tirer ou de faire une passe.',
    keywords: ['demis', 'milieu', 'deux touches', '5', 'but des demis', 'compte double'],
  },
  {
    id: 'roulette',
    myth: '« Toute roulette est formellement interdite ! »',
    verdict: 'NUANCED',
    verdictLabel: 'AUTORISÉE SI ≤ 360°',
    officialRule: 'Autorisée sous réserve d’un tour maximum (360°) avant et après la frappe',
    explanation:
      'Une roulette contrôlée (moins de 360° avant la frappe et moins de 360° après frappe, sans lâcher la poignée) est légale ! Ce qui est strictement interdit, c’est la « moulinette » en roue libre : faire tourner la barre à toute vitesse de manière répétée ou lâcher la barre pour la faire tourner sur son élan.',
    keywords: ['roulette', 'moulinette', '360', 'tourner', 'rotation', 'poignee'],
  },
  {
    id: 'coin-slide',
    myth: '« En cas de sortie, on remet la balle dans le coin en la faisant glisser ! »',
    verdict: 'ILLEGAL',
    verdictLabel: 'INTERDIT (Mythe de bar)',
    officialRule: 'Remise obligatoirement arrêtée aux arrières avec annonce « Prêt ? »',
    explanation:
      'Le « glissé au coin » est une mauvaise habitude de bistrot. En règle officielle, la balle doit être placée et totalement immobilisée sous le pied du gardien ou d’un arrière. Le joueur demande « Prêt ? » et doit attendre la réponse affirmative de l’adversaire avant de la jouer.',
    keywords: ['coin', 'glisse', 'couloir', 'remise', 'pret'],
  },
  {
    id: 'gamelle-penalty',
    myth: '« Une gamelle enlève un point ou donne -1 au score ! »',
    verdict: 'LEGAL',
    verdictLabel: 'BUT NORMAL (+1)',
    officialRule: 'Une gamelle vaut un but classique (+1)',
    explanation:
      'La « gamelle » (balle qui entre dans le but et en ressort sous la violence du tir) est un but parfaitement valable qui rapporte 1 point normal à l’équipe qui a tiré. Elle n’enlève aucun point à l’adversaire et n’a pas de valeur spéciale.',
    keywords: ['gamelle', 'ressort', 'moins un', 'point'],
  },
  {
    id: 'peche',
    myth: '« On peut rattraper la balle à la main si elle rebondit dans les airs ! »',
    verdict: 'ILLEGAL',
    verdictLabel: 'STRICTEMENT INTERDIT',
    officialRule: 'Faute technique immédiate (« pêche »)',
    explanation:
      'Il est formellement interdit de mettre les mains dans l’espace de jeu pendant un échange, même si la balle saute. La balle doit retomber ou sortir naturellement. Toucher la balle ou le terrain à la main entraîne une sanction immédiate (balle rendue aux arrières adverses).',
    keywords: ['peche', 'main', 'rattraper', 'toucher', 'doigt'],
  },
  {
    id: 'rateau-choc',
    myth: '« Claquer les barres violemment contre les bords pour bloquer la balle est légal ! »',
    verdict: 'ILLEGAL',
    verdictLabel: 'FAUTE (Choc / Secousse)',
    officialRule: 'Interdiction de heurter violemment les butées ou de secouer le meuble',
    explanation:
      'Les chocs brutaux contre les bandes (« jarrets ») dans le but de faire sauter la balle ou de déstabiliser le contrôle de l’adversaire sont sanctionnés. Le baby-foot se joue sur la technique de placement, pas sur la secousse mécanique de la table.',
    keywords: ['rateau', 'choc', 'jarret', 'secousse', 'claquer', 'butee'],
  },
]

interface OfficialRuleSection {
  id: string
  title: string
  icon: string
  items: { subtitle: string; content: string }[]
  keywords: string[]
}

const officialRules: OfficialRuleSection[] = [
  {
    id: 'engagement',
    title: 'Engagement & Mise en jeu',
    icon: '⚽',
    items: [
      {
        subtitle: 'Tirage au sort initial',
        content:
          'En début de rencontre, un tirage au sort (pièce ou pile ou face) désigne l’équipe qui effectue le premier engagement aux demis.',
      },
      {
        subtitle: 'Après chaque but marqué',
        content:
          'L’engagement revient systématiquement à la barre des demis (5 joueurs) de l’équipe qui vient d’encaisser le but.',
      },
      {
        subtitle: 'Règle des deux touches obligatoires',
        content:
          'Lors de l’engagement aux demis, la balle doit impérativement être touchée par au moins deux figurines distinctes de la barre des demis avant de pouvoir franchir la ligne ou faire l’objet d’un tir.',
      },
      {
        subtitle: 'L’annonce « Prêt ? »',
        content:
          'Avant de mettre la balle en mouvement lors de toute remise en jeu (demis ou arrières), le joueur ayant la balle doit demander vocalement « Prêt ? » et attendre la confirmation claire (« Prêt ! » ou « Oui ») de son adversaire.',
      },
    ],
    keywords: ['engagement', 'service', 'deux touches', 'pret', 'demis', 'tirage'],
  },
  {
    id: 'dead-ball',
    title: 'Balle morte (Inaccessible)',
    icon: '🛑',
    items: [
      {
        subtitle: 'Balle arrêtée entre les barres de demis (zone centrale)',
        content:
          'Si la balle s’immobilise totalement hors de portée entre les deux barres de 5, elle est remise en jeu aux demis de l’équipe qui avait engagé à l’origine.',
      },
      {
        subtitle: 'Balle arrêtée entre les demis et le but (zone défensive)',
        content:
          'Si la balle s’immobilise entre la ligne des demis et le fond du terrain, elle est remise aux arrières (défense/gardien) du camp dans lequel elle est arrêtée.',
      },
      {
        subtitle: 'Interdiction de souffler ou secouer',
        content:
          'Il est strictement interdit de souffler sur la balle ou de secouer la table pour la débloquer.',
      },
    ],
    keywords: ['balle morte', 'arretee', 'inaccessible', 'coincee', 'portee'],
  },
  {
    id: 'possession-time',
    title: 'Temps de possession',
    icon: '⏱️',
    items: [
      {
        subtitle: 'Aux arrières et au gardien : 10 secondes',
        content:
          'Le défenseur ou gardien dispose de 10 secondes maximum pour relancer ou tirer une fois le contrôle établi.',
      },
      {
        subtitle: 'Aux demis (barre de 5) : 10 secondes',
        content: 'La barre du milieu dispose de 10 secondes maximum pour passer la balle ou tirer.',
      },
      {
        subtitle: 'Aux avants (barre de 3) : 15 secondes',
        content:
          'L’attaquant dispose de 15 secondes maximum pour armer son tir ou combiner avec sa barre.',
      },
    ],
    keywords: ['temps', 'possession', 'secondes', 'limite', 'delai'],
  },
  {
    id: 'fouls',
    title: 'Fautes techniques & Comportement',
    icon: '🚩',
    items: [
      {
        subtitle: 'Roulettes et moulinettes',
        content:
          'Toute rotation continue de la barre supérieure à 360° sans contrôle est une faute. Balle rendue à l’adversaire.',
      },
      {
        subtitle: 'Chocs de barre et secousses de la table',
        content:
          'Taper les butées en caoutchouc violemment pour faire trembler la table ou déloger une balle est sanctionné.',
      },
      {
        subtitle: 'Mains dans le jeu (« Pêche »)',
        content:
          'Toucher la balle avec la main pendant qu’elle est en jeu est formellement interdit sans accord préalable des deux camps.',
      },
      {
        subtitle: 'Distraction sonore ou visuelle',
        content:
          'Crier au moment du tir adverse, agiter les barres sans intention de jouer ou frapper des mains pour déconcentrer est interdit.',
      },
    ],
    keywords: ['fautes', 'chocs', 'roulettes', 'moulinettes', 'peche', 'distraction'],
  },
]

interface TournamentFeature {
  title: string
  icon: string
  description: string
  details: string[]
}

const tournamentRules: TournamentFeature[] = [
  {
    title: 'Duel en 4 matchs par paire',
    icon: '👥',
    description:
      'Chaque confrontation entre deux équipes se compose d’une série complète de 4 matchs.',
    details: [
      'Chaque joueur dispute 2 matchs au poste d’attaque et 2 matchs au poste de défense.',
      'Toutes les configurations croisées (Attaquant A vs Défenseur B, etc.) sont jouées pour tester la polyvalence.',
      'Permet d’attribuer équitablement les trophées du Meilleur Attaquant et Meilleur Défenseur.',
    ],
  },
  {
    title: 'Équité de la table : Inversion des côtés',
    icon: '🔄',
    description:
      'Pour éliminer tout biais lié à l’état de la table (légère pente, éclairage, sensations), les côtés alternent automatiquement.',
    details: [
      'L’application HandiBaby attribue les côtés Bleu et Blanc pour chaque match.',
      'Une équipe joue deux fois côté Bleu et deux fois côté Blanc.',
      'En cas d’erreur de côté lors d’une partie, un bouton « Inverser les côtés » permet de corriger le match sans perdre les rôles.',
    ],
  },
  {
    title: 'Score à 10 points secs',
    icon: '🎯',
    description:
      'Chaque manche se joue au premier qui atteint 10 buts (pas d’avantage de 2 points nécessaire).',
    details: [
      'Un score final est toujours sous la forme 10 – X (où X est entre 0 et 9).',
      'Pas de match nul possible.',
      'Le perdant marque entre 0 et 9 points, ce qui alimente la différence de buts au classement général.',
    ],
  },
  {
    title: 'Playoff au format Page (Double chance)',
    icon: '🏆',
    description:
      'Le tableau final utilise le système de playoff « Page », récompensant la régularité en phase de poule.',
    details: [
      'Qualif 1 (1er vs 2e) : Le vainqueur file directement en Grande Finale ! Le perdant conserve une 2e chance.',
      'Élimination (3e vs 4e) : Match couperet, le vainqueur accède à la Demi-Finale, le perdant termine 4e.',
      'Demi-Finale : Le perdant de Qualif 1 affronte le vainqueur d’Élimination pour la dernière place en Finale.',
      'Grande Finale : Le vainqueur de Qualif 1 affronte le vainqueur de la Demi-Finale pour le titre suprême.',
    ],
  },
  {
    title: 'Critères de départage du classement',
    icon: '📊',
    description:
      'En cas d’égalité au nombre de victoires en phase de classement, les critères officiels s’appliquent dans l’ordre :',
    details: [
      '1. Nombre total de victoires.',
      '2. Confrontations directes entre les équipes à égalité (Head-to-Head).',
      '3. Différence de buts générale (buts marqués moins buts encaissés).',
      '4. Meilleure attaque (nombre total de buts marqués).',
    ],
  },
]

// Search and filter logic
const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())

const filteredScenarios = computed(() => {
  if (!normalizedQuery.value) return scenarios
  const q = normalizedQuery.value
  return scenarios.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.subtitle.toLowerCase().includes(q) ||
      s.shortDecision.toLowerCase().includes(q) ||
      s.ruleExplanation.toLowerCase().includes(q) ||
      s.keywords.some((k) => k.includes(q)),
  )
})

const filteredMyths = computed(() => {
  if (!normalizedQuery.value) return myths
  const q = normalizedQuery.value
  return myths.filter(
    (m) =>
      m.myth.toLowerCase().includes(q) ||
      m.officialRule.toLowerCase().includes(q) ||
      m.explanation.toLowerCase().includes(q) ||
      m.keywords.some((k) => k.includes(q)),
  )
})

const filteredOfficialRules = computed(() => {
  if (!normalizedQuery.value) return officialRules
  const q = normalizedQuery.value
  return officialRules.filter(
    (section) =>
      section.title.toLowerCase().includes(q) ||
      section.keywords.some((k) => k.includes(q)) ||
      section.items.some(
        (it) => it.subtitle.toLowerCase().includes(q) || it.content.toLowerCase().includes(q),
      ),
  )
})

const filteredTournamentRules = computed(() => {
  if (!normalizedQuery.value) return tournamentRules
  const q = normalizedQuery.value
  return tournamentRules.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.details.some((d) => d.toLowerCase().includes(q)),
  )
})

const totalMatchesCount = computed(() => {
  if (!normalizedQuery.value) return null
  return (
    filteredScenarios.value.length +
    filteredMyths.value.length +
    filteredOfficialRules.value.length +
    filteredTournamentRules.value.length
  )
})

function selectScenario(id: string) {
  selectedScenarioId.value = id
}
</script>

<template>
  <div class="space-y-10">
    <!-- Header -->
    <header class="space-y-3">
      <div class="flex items-center gap-3">
        <RouterLink to="/tournois" class="text-sm text-chalk-400 hover:text-chalk-100">
          ← Retour aux tournois
        </RouterLink>
      </div>

      <div class="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-chalk-100">
            Règles Officielles & Arbitrage
          </h1>
          <p class="mt-1 text-sm text-chalk-400 max-w-2xl">
            Règles officielles de la Fédération Française de Football de Table (FFFT / ITSF),
            arbitrage des litiges de sortie de balle, mythes de bistrot décryptés et spécificités du
            format HandiBaby.
          </p>
        </div>
      </div>

      <!-- Quick Search Bar -->
      <div class="relative pt-2">
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Rechercher une règle, un cas litigieux (ex: sortie, pissette, demis, roulette, prêt)..."
          class="w-full rounded-xl border border-pitch-700 bg-pitch-900 px-4 py-2.5 text-sm text-chalk-100 placeholder-chalk-400/60 outline-none transition focus:border-ball focus:ring-1 focus:ring-ball"
        />
        <span
          v-if="totalMatchesCount !== null"
          class="absolute right-3 top-5 text-xs text-chalk-400"
        >
          {{ totalMatchesCount }} résultat{{ totalMatchesCount > 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Navigation Tabs -->
      <nav class="flex flex-wrap gap-2 pt-2 border-b border-pitch-800 pb-3" aria-label="Sections">
        <button
          type="button"
          class="rounded-lg px-3.5 py-1.5 text-sm font-medium transition cursor-pointer"
          :class="
            activeTab === 'all'
              ? 'bg-ball text-pitch-950 font-semibold shadow-xs'
              : 'border border-pitch-700 text-chalk-400 hover:border-ball hover:text-chalk-100'
          "
          @click="activeTab = 'all'"
        >
          Tout afficher
        </button>
        <button
          type="button"
          class="rounded-lg px-3.5 py-1.5 text-sm font-medium transition cursor-pointer"
          :class="
            activeTab === 'out-of-bounds'
              ? 'bg-ball text-pitch-950 font-semibold shadow-xs'
              : 'border border-pitch-700 text-chalk-400 hover:border-ball hover:text-chalk-100'
          "
          @click="activeTab = 'out-of-bounds'"
        >
          ⚡ Sortie de Balle (Arbitrage)
        </button>
        <button
          type="button"
          class="rounded-lg px-3.5 py-1.5 text-sm font-medium transition cursor-pointer"
          :class="
            activeTab === 'official'
              ? 'bg-ball text-pitch-950 font-semibold shadow-xs'
              : 'border border-pitch-700 text-chalk-400 hover:border-ball hover:text-chalk-100'
          "
          @click="activeTab = 'official'"
        >
          📜 Règles FFFT
        </button>
        <button
          type="button"
          class="rounded-lg px-3.5 py-1.5 text-sm font-medium transition cursor-pointer"
          :class="
            activeTab === 'myths'
              ? 'bg-ball text-pitch-950 font-semibold shadow-xs'
              : 'border border-pitch-700 text-chalk-400 hover:border-ball hover:text-chalk-100'
          "
          @click="activeTab = 'myths'"
        >
          🍻 Vrai ou Faux (Mythes de bar)
        </button>
        <button
          type="button"
          class="rounded-lg px-3.5 py-1.5 text-sm font-medium transition cursor-pointer"
          :class="
            activeTab === 'handibaby'
              ? 'bg-ball text-pitch-950 font-semibold shadow-xs'
              : 'border border-pitch-700 text-chalk-400 hover:border-ball hover:text-chalk-100'
          "
          @click="activeTab = 'handibaby'"
        >
          🏆 Format HandiBaby
        </button>
      </nav>
    </header>

    <!-- SECTION 1: LITIGE SORTIE DE BALLE (L'AIDE À LA DÉCISION) -->
    <section
      v-if="
        (activeTab === 'all' || activeTab === 'out-of-bounds') &&
        (!normalizedQuery || filteredScenarios.length > 0)
      "
      id="out-of-bounds"
      class="space-y-6"
    >
      <div class="flex items-center gap-2">
        <span class="text-xl">⚡</span>
        <div>
          <h2 class="text-lg font-semibold text-chalk-100">
            Arbitrage : Balle sortie du terrain, à qui revient-elle ?
          </h2>
          <p class="text-xs text-chalk-400">
            Source numéro un de débats au bord du baby-foot. Choisissez la situation pour trancher
            instantanément selon le règlement FFFT.
          </p>
        </div>
      </div>

      <!-- Quick Interactive Solver -->
      <div class="rounded-2xl border border-pitch-700 bg-pitch-900/90 p-5 sm:p-6 shadow-md">
        <h3 class="text-sm font-semibold uppercase tracking-wider text-ball mb-4">
          👉 Que vient-il de se passer sur la table ?
        </h3>

        <!-- Scenario Selector Chips / Buttons -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-6">
          <button
            v-for="scenario in filteredScenarios"
            :key="scenario.id"
            type="button"
            class="text-left rounded-xl p-3 border transition cursor-pointer flex flex-col justify-between"
            :class="
              selectedScenarioId === scenario.id
                ? 'border-ball bg-pitch-800 text-chalk-100 shadow-sm'
                : 'border-pitch-800 bg-pitch-950/60 text-chalk-400 hover:border-pitch-700 hover:text-chalk-100'
            "
            @click="selectScenario(scenario.id)"
          >
            <div class="flex items-start gap-2.5">
              <span class="text-xl shrink-0">{{ scenario.icon }}</span>
              <div>
                <p class="text-sm font-semibold leading-snug">{{ scenario.title }}</p>
                <p class="text-xs opacity-75 mt-0.5 line-clamp-2">{{ scenario.subtitle }}</p>
              </div>
            </div>
            <div class="mt-3 flex items-center justify-between text-xs">
              <span class="font-medium text-ball">{{ scenario.shortDecision }}</span>
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase"
                :class="
                  selectedScenarioId === scenario.id
                    ? 'bg-ball text-pitch-950'
                    : 'bg-pitch-800 text-chalk-400'
                "
              >
                {{ selectedScenarioId === scenario.id ? 'Sélectionné' : 'Voir' }}
              </span>
            </div>
          </button>
        </div>

        <!-- Detailed Decision Box for Selected Scenario -->
        <div class="rounded-xl border border-pitch-700 bg-pitch-950 p-5 space-y-4">
          <div
            class="flex flex-wrap items-center justify-between gap-3 border-b border-pitch-800 pb-3"
          >
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">{{ selectedScenario.icon }}</span>
              <div>
                <span class="text-xs font-semibold uppercase tracking-wider text-chalk-400">
                  Décision officielle
                </span>
                <h4 class="text-base sm:text-lg font-bold text-chalk-100">
                  {{ selectedScenario.title }}
                </h4>
              </div>
            </div>

            <!-- Beneficiary Badge -->
            <div
              class="rounded-lg px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide border"
              :class="
                selectedScenario.beneficiary === 'defense'
                  ? 'bg-sky-950/80 text-sky-300 border-sky-700'
                  : selectedScenario.beneficiary === 'shooter'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                    : 'bg-rose-950/80 text-rose-300 border-rose-700'
              "
            >
              {{ selectedScenario.beneficiaryLabel }}
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div class="space-y-1.5">
              <h5 class="text-xs font-medium uppercase tracking-wider text-chalk-400">
                Pourquoi cette décision ? (Principe FFFT)
              </h5>
              <p class="text-chalk-100/90 leading-relaxed text-sm">
                {{ selectedScenario.ruleExplanation }}
              </p>
            </div>

            <div class="space-y-1.5 rounded-lg bg-pitch-900/60 p-3.5 border border-pitch-800">
              <h5 class="text-xs font-medium uppercase tracking-wider text-ball">
                Où et comment remettre en jeu ?
              </h5>
              <p class="text-chalk-100 text-sm font-medium">
                {{ selectedScenario.restartLocation }}
              </p>
              <p class="text-xs text-chalk-400 pt-1">
                🗣️ Le joueur doit impérativement demander vocalement <strong>« Prêt ? »</strong> et
                attendre la réponse adverse avant de jouer !
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Visual Summary Table / Quick Reference Cards -->
      <div class="space-y-3">
        <h3 class="text-xs font-semibold tracking-wider text-chalk-400 uppercase">
          Synthèse des 4 cas de figure majeurs
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="scenario in filteredScenarios.slice(0, 4)"
            :key="scenario.id"
            class="rounded-xl border border-pitch-800 bg-pitch-900/50 p-4 space-y-2 hover:border-pitch-700 transition"
          >
            <div class="flex items-center gap-2">
              <span class="text-lg">{{ scenario.icon }}</span>
              <h4 class="font-medium text-sm text-chalk-100">{{ scenario.title }}</h4>
            </div>
            <p class="text-xs text-chalk-400">{{ scenario.subtitle }}</p>
            <div class="pt-1 flex items-center justify-between text-xs">
              <span class="text-chalk-400">Attribution :</span>
              <span class="font-semibold text-ball">{{ scenario.shortDecision }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Crucial Reminder Box: The restart protocol -->
      <div
        class="rounded-xl border border-amber-800/60 bg-amber-950/30 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start"
      >
        <span class="text-3xl shrink-0">⚠️</span>
        <div class="space-y-1 text-sm">
          <h4 class="font-bold text-amber-200">
            Protocole officiel de remise en jeu (À respecter impérativement)
          </h4>
          <p class="text-amber-200/90 text-xs sm:text-sm leading-relaxed">
            1. <strong>Arrêt complet</strong> : la balle est posée et immobilisée sous le pied d’un
            des arrières ou du gardien.<br />
            2. <strong>L'annonce « Prêt ? »</strong> : le joueur interpelle l’adversaire.<br />
            3. <strong>La validation « Prêt ! »</strong> : l’adversaire doit répondre OUI avant
            toute mise en mouvement de la balle.<br />
            4. <strong>Interdiction du « coin »</strong> : faire glisser la balle dans le coin en
            bois est un mythe de bar formellement <u>interdit</u> en compétition.
          </p>
        </div>
      </div>
    </section>

    <!-- SECTION 2: RÈGLES OFFICIELLES FFFT -->
    <section
      v-if="
        (activeTab === 'all' || activeTab === 'official') &&
        (!normalizedQuery || filteredOfficialRules.length > 0)
      "
      id="official-rules"
      class="space-y-6"
    >
      <div class="flex items-center gap-2">
        <span class="text-xl">📜</span>
        <div>
          <h2 class="text-lg font-semibold text-chalk-100">
            Règles Officielles du Baby-Foot (FFFT / ITSF)
          </h2>
          <p class="text-xs text-chalk-400">
            Les règles standard appliquées en tournoi officiel et compétitions fédérales.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="section in filteredOfficialRules"
          :key="section.id"
          class="rounded-xl border border-pitch-800 bg-pitch-900 p-5 space-y-4"
        >
          <div class="flex items-center gap-2.5 border-b border-pitch-800 pb-3">
            <span class="text-xl">{{ section.icon }}</span>
            <h3 class="font-semibold text-sm text-chalk-100">{{ section.title }}</h3>
          </div>

          <ul class="space-y-3">
            <li
              v-for="(item, idx) in section.items"
              :key="idx"
              class="space-y-0.5 text-xs sm:text-sm"
            >
              <h4 class="font-medium text-ball">{{ item.subtitle }}</h4>
              <p class="text-chalk-400 leading-relaxed">{{ item.content }}</p>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- SECTION 3: MYTHES DE BAR (VRAI / FAUX) -->
    <section
      v-if="
        (activeTab === 'all' || activeTab === 'myths') &&
        (!normalizedQuery || filteredMyths.length > 0)
      "
      id="myths"
      class="space-y-6"
    >
      <div class="flex items-center gap-2">
        <span class="text-xl">🍻</span>
        <div>
          <h2 class="text-lg font-semibold text-chalk-100">
            Le Vrai ou Faux : Les Mythes de Bar décryptés
          </h2>
          <p class="text-xs text-chalk-400">
            Pissette, but des demis, roulette, gamelle : démêlez les vraies règles des croyances
            populaires nées autour d’une bière !
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3.5">
        <div
          v-for="item in filteredMyths"
          :key="item.id"
          class="rounded-xl border border-pitch-800 bg-pitch-900 p-4 sm:p-5 space-y-2.5 hover:border-pitch-700 transition"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm sm:text-base font-bold text-chalk-100">{{ item.myth }}</h3>
            <span
              class="rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider border"
              :class="
                item.verdict === 'LEGAL'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                  : item.verdict === 'ILLEGAL'
                    ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                    : 'bg-amber-950/80 text-amber-300 border-amber-700'
              "
            >
              {{ item.verdictLabel }}
            </span>
          </div>

          <p class="text-xs font-semibold text-ball">{{ item.officialRule }}</p>
          <p class="text-xs sm:text-sm text-chalk-400 leading-relaxed">{{ item.explanation }}</p>
        </div>
      </div>
    </section>

    <!-- SECTION 4: FORMAT DU TOURNOI HANDIBABY -->
    <section
      v-if="
        (activeTab === 'all' || activeTab === 'handibaby') &&
        (!normalizedQuery || filteredTournamentRules.length > 0)
      "
      id="handibaby"
      class="space-y-6"
    >
      <div class="flex items-center gap-2">
        <span class="text-xl">🏆</span>
        <div>
          <h2 class="text-lg font-semibold text-chalk-100">
            Le Format Officiel du Tournoi HandiBaby
          </h2>
          <p class="text-xs text-chalk-400">
            Comment fonctionne l’application, la formule de match par duel et le système de playoff
            équitable.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="(feature, idx) in filteredTournamentRules"
          :key="idx"
          class="rounded-xl border border-pitch-800 bg-pitch-900 p-5 space-y-3"
        >
          <div class="flex items-center gap-2.5 border-b border-pitch-800 pb-3">
            <span class="text-xl">{{ feature.icon }}</span>
            <h3 class="font-semibold text-sm text-chalk-100">{{ feature.title }}</h3>
          </div>

          <p class="text-xs sm:text-sm text-chalk-100 font-medium leading-relaxed">
            {{ feature.description }}
          </p>

          <ul class="space-y-1.5 text-xs text-chalk-400 list-disc list-inside">
            <li v-for="(detail, dIdx) in feature.details" :key="dIdx">
              {{ detail }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Empty Search State -->
    <div
      v-if="totalMatchesCount === 0"
      class="rounded-2xl border border-pitch-800 bg-pitch-900/60 p-8 text-center space-y-3"
    >
      <p class="text-chalk-400 text-sm">
        Aucun résultat trouvé pour « <span class="text-chalk-100">{{ searchQuery }}</span> ».
      </p>
      <button
        type="button"
        class="rounded-lg border border-pitch-700 px-4 py-2 text-xs font-semibold text-chalk-100 hover:border-ball cursor-pointer"
        @click="searchQuery = ''"
      >
        Réinitialiser la recherche
      </button>
    </div>
  </div>
</template>
