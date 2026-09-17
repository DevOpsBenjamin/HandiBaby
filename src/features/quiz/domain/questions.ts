import type { QuizQuestion } from './types'

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    page: 1,
    question:
      'Selon le préambule officiel du guide pédagogique de la FFFT, par qui et à quelle date exacte ce document a-t-il été rédigé ?',
    options: [
      { id: 'a', label: 'En août 2014, par la Commission Formation de la FFFT' },
      { id: 'b', label: 'En septembre 2015, par la Direction Technique Nationale' },
      {
        id: 'c',
        label:
          'Par Damien Benéteau, Alexandre Berlemont, Cédric Got, Brice Harpin et Noureddine Houcine',
      },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['a', 'c'],
    explanation:
      'Préambule (page 1) : « Guide réalisé en aout 2014 par la Commission Formation : Damien Benéteau, Alexandre Berlemont, Cédric Got, Brice Harpin et Noureddine Houcine ». Les propositions A et C sont toutes les deux rigoureusement exactes.',
  },
  {
    id: 2,
    page: 1,
    question:
      'Combien de fiches pédagogiques composent très précisément ce guide d’apprentissage édité par la FFFT ?',
    options: [
      { id: 'a', label: '51 fiches (soit le nombre exact de pages du document)' },
      { id: 'b', label: '57 fiches pédagogiques' },
      { id: 'c', label: '45 fiches pédagogiques' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['b'],
    explanation:
      'Préambule (page 1) : « La diversité et la progressivité des 57 fiches pédagogiques proposées doit permettre aux formateurs d’intéresser et d’améliorer les compétences de leur auditoire ». Même si le livret compte 51 pages, il y a bien 57 fiches !',
  },
  {
    id: 3,
    page: 4,
    question:
      'D’après les conventions de départ et le lexique officiel (pages 4 et 5), comment sont rigoureusement distingués les termes sur la table ?',
    options: [
      { id: 'a', label: 'Le mot « joueur » désigne la personne physique qui dispute la partie' },
      { id: 'b', label: 'Le mot « bafiste » désigne la figurine en aluminium fixée sur la barre' },
      {
        id: 'c',
        label:
          'Le « bafiste » désigne le ou la pratiquant(e) de baby-foot (football de table)',
      },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['c'],
    explanation:
      'Conventions (page 4) & Lexique (page 5) : « On distingue le "bafiste" qui est celui qui pratique le Baby-foot (...) du "joueur" qui désigne la figurine fixée aux barres ». Le joueur est la figurine, le bafiste est l’humain !',
  },
  {
    id: 4,
    page: 4,
    question:
      'Selon la convention d’appellation des figurines et des barres (page 4), comment procède-t-on pour numéroter ?',
    options: [
      { id: 'a', label: 'On part toujours du joueur le plus proche du bafiste' },
      { id: 'b', label: 'Les arrières correspondent aux joueurs n°2-1 et n°2-2' },
      { id: 'c', label: 'L’attaquant central porte obligatoirement le matricule n°3-2' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['a', 'b', 'c'],
    explanation:
      'Conventions (page 4) : « Toujours partir du joueur le plus proche du bafiste ; le premier numéro correspond à l’appellation de la barre puis le second à la numérotation du joueur ». Les arrières sont 2-1 et 2-2, et les avants sont 3-1, 3-2 et 3-3. Les trois propositions sont vraies !',
  },
  {
    id: 5,
    page: 5,
    question:
      'D’après le lexique officiel (page 5), que caractérise très exactement une « poussée longue » ou une « tirée longue » ?',
    options: [
      { id: 'a', label: 'Le tir est obligatoirement un tir croisé dans l’angle opposé' },
      {
        id: 'b',
        label:
          'Le bafiste effectue le tir en déplaçant sa barre dans sa latéralité maximale',
      },
      {
        id: 'c',
        label:
          'Le tir est droit : la balle arrive dans la partie la plus éloignée de la cage par rapport à la position de départ',
      },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['b', 'c'],
    explanation:
      'Lexique (page 5) : « Poussée longue / Tirée longue : le bafiste effectue une poussée/tirée en déplaçant sa barre dans sa latéralité maximale. Le tir est droit. La balle arrive donc dans la partie la plus éloignée de la cage par rapport à la position de départ ». Contrairement à l’intuition, le tir est expressément droit !',
  },
  {
    id: 6,
    page: 8,
    question:
      'Dans la section historique des tirs en main fermée (page 8), quelles marques de baby-foot à barres télescopiques sont explicitement citées ?',
    options: [
      { id: 'a', label: 'Bonzini, René Pierre et Stella' },
      { id: 'b', label: 'Bonzini, Garlando et Roberto Sport' },
      { id: 'c', label: 'Sulpie, René Pierre et Monneret' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['none'],
    explanation:
      'Historique (page 8) : Les seules marques de tables télescopiques citées mot pour mot sont « Sulpie, Petitot, Bonzini... ». Aucune des propositions A, B ou C ne liste ce trio exact. La bonne réponse est donc « Aucune de ces réponses » !',
  },
  {
    id: 7,
    page: 8,
    question:
      'Dans la fiche technique de la « main fermée » (page 8), à quoi la prise en main de la poignée est-elle métaphoriquement comparée ?',
    options: [
      { id: 'a', label: 'À un manche de raquette de tennis' },
      { id: 'b', label: 'À « une poignée de mobylette »' },
      { id: 'c', label: 'À un levier de vitesse automobile' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['b'],
    explanation:
      'Positionnement (page 8) : « La main du bafiste est généralement la paume vers le sol, en prenant la poignée comme "une poignée de mobylette" qui permet au bafiste d’obtenir une bonne rotation de la barre en utilisant son poignet ».',
  },
  {
    id: 8,
    page: 8,
    question:
      'Selon la section historique de la « main fermée » (page 8), dans quels pays retrouve-t-on le plus fréquemment cette technique ?',
    options: [
      { id: 'a', label: 'La France et le Danemark' },
      { id: 'b', label: 'La République Tchèque et le Cameroun' },
      { id: 'c', label: 'L’Espagne et le Portugal' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['a', 'b'],
    explanation:
      'Historique (page 8) : « Les pays où l’on peut retrouver plus de main fermée sont la France, le Danemark, la République Tchèque, le Cameroun... ». Les choix A et B sont tous les deux expressément mentionnés.',
  },
  {
    id: 9,
    page: 9,
    question:
      'Concernant la technique du tir en « main ouverte » (page 9), que précise le livret fédéral ?',
    options: [
      {
        id: 'a',
        label:
          'On peut notamment observer ce tir en Belgique et en Allemagne depuis de nombreuses années',
      },
      {
        id: 'b',
        label:
          'La rotation s’effectue en faisant rouler la poignée dans la paume de la main orientée vers le ciel',
      },
      {
        id: 'c',
        label:
          'Par convention, ce type de tir est utilisé en démarrant au milieu des cages',
      },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['a', 'b', 'c'],
    explanation:
      'La main ouverte (page 9) : Tous ces détails figurent aux rubriques Historique (« Belgique et Allemagne »), Positionnement (« rouler la poignée dans la paume... en direction du ciel ») et Principe (« par convention ce type de tir est utilisé en démarrant au milieu des cages »). Les trois affirmations sont vraies !',
  },
  {
    id: 10,
    page: 10,
    question:
      'Sur quelle table historique et selon quelle convention le « Snake » est-il né et exécuté (page 10) ?',
    options: [
      { id: 'a', label: 'Technique créée aux États-Unis sur la table « Tornado »' },
      {
        id: 'b',
        label:
          'L’intérieur du poignet est positionné contre le côté droit de la poignée',
      },
      {
        id: 'c',
        label:
          'L’avant-bras doit être placé perpendiculaire au sol pour obtenir une sensation de rouler',
      },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['a', 'b', 'c'],
    explanation:
      'Le Snake (page 10) : « Technique de tir créée aux États-Unis notamment sur la table "Tornado" » et « positionner l’intérieur du poignet contre le côté droit de la poignée, mettre l’avant-bras perpendiculaire au sol pour obtenir une sensation de rouler sur la poignée ».',
  },
  {
    id: 11,
    page: 11,
    question:
      'Dans la fiche technique du « Pull-Shot & Push-Shot » (page 11), quel écartement exact doit séparer la balle du flanc de la figurine au départ ?',
    options: [
      { id: 'a', label: 'Exactement 5 millimètres' },
      { id: 'b', label: '1 centimètre d’écart' },
      { id: 'c', label: 'La balle doit impérativement être collée au pied' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['none'],
    explanation:
      'Pull-Shot & Push-Shot (page 11) : Le manuel stipule très précisément : « La balle est placée sur le côté du joueur sans se toucher en laissant 1mm ». La réponse est donc « Aucune de ces réponses » (c’est 1 mm !).',
  },
  {
    id: 12,
    page: 13,
    question:
      'Dès l’étape 1 (fiche 1a, page 13), à quelle distance exacte de la table le bafiste doit-il se positionner pour bloquer une balle ?',
    options: [
      { id: 'a', label: 'À une distance d’avant-bras de la table' },
      { id: 'b', label: 'À un mètre de distance pour anticiper' },
      { id: 'c', label: 'Le buste collé au bois de la table' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['a'],
    explanation:
      'Étape 1 (page 13, fiche 1a) : « Me placer pour avoir le dos à plat, être placé solidement en appui sur les pieds. Se placer à une distance d’avant-bras de la table ».',
  },
  {
    id: 13,
    page: 13,
    question:
      'Dans l’étape 1 (fiche 1a, page 13), de quelle hauteur les figurines doivent-elles être inclinées lors du déplacement pour stopper la balle ?',
    options: [
      { id: 'a', label: 'D’un demi-diamètre de balle' },
      { id: 'b', label: 'D’une hauteur de balle' },
      { id: 'c', label: 'D’exactement 45 degrés' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['b'],
    explanation:
      'Étape 1 (page 13) : « Déplacer la barre en ayant les joueurs toujours inclinés d’une hauteur de balle ». Cette consigne revient sur quasiment toutes les fiches de blocage !',
  },
  {
    id: 14,
    page: 13,
    question:
      'Pour passer d’une position de « marteau » à une position de « pince » à petite vitesse (page 13, fiche 2b), que prescrit le manuel ?',
    options: [
      {
        id: 'a',
        label:
          'Prendre la poignée de préférence avec la paume de la main orientée vers le ciel',
      },
      { id: 'b', label: 'Effectuer une rotation du poignet vers l’avant' },
      { id: 'c', label: 'Tirer ou pousser la barre dans le même mouvement' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['a', 'b', 'c'],
    explanation:
      'Étape 1 (page 13, fiche 2b) : « Prendre la poignée de la barre concernée de préférence avec la paume de la main vers le ciel. (...) tirer ou pousser la barre en effectuant une rotation du poignet vers l’avant. Ce geste s’effectue dans le même mouvement ». Les trois instructions sont obligatoires !',
  },
  {
    id: 15,
    page: 15,
    question:
      'Lors du déplacement latéral de la balle sous un même joueur en pince (étape 2, fiche 1a, page 15), quelle recommandation est formulée ?',
    options: [
      {
        id: 'a',
        label: 'Privilégier le déplacement de la balle en amplitude et non en fréquence',
      },
      {
        id: 'b',
        label: 'Privilégier le déplacement de la balle en fréquence et non en amplitude',
      },
      { id: 'c', label: 'Pour faire avancer la balle, la tapoter rapidement' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['b', 'c'],
    explanation:
      'Étape 2 (page 15, fiche 1a) : « Pour la faire avancer, tapoter la rapidement. Pour déplacer la balle latéralement sous un même joueur, privilégier le déplacement de celle-ci en fréquence et non en amplitude ».',
  },
  {
    id: 16,
    page: 26,
    question:
      'Pour défendre sur un tir de l’attaquant central (étape 4, page 26, fiche 1a), comment incliner le gardien et le défenseur pour fermer le tir croisé ?',
    options: [
      { id: 'a', label: 'Le défenseur vers l’avant et le gardien vers l’arrière' },
      { id: 'b', label: 'Le défenseur vers l’arrière et le gardien vers l’avant' },
      { id: 'c', label: 'Les deux joueurs rigoureusement verticaux' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['b'],
    explanation:
      'Étape 4 (page 26, fiche 1a) : « Incliner ces deux joueurs pour ne pas laisser de place à un tir croisé (le défenseur vers l’arrière, le gardien vers l’avant). Attention de ne pas trop incliner les joueurs, la balle pourrait passer en-dessous ».',
  },
  {
    id: 17,
    page: 47,
    question:
      'Dans la fiche du « Jeu des balles rebondissantes » (page 47), quel est le diamètre officiel exact rappelé pour une balle de baby-foot ?',
    options: [
      { id: 'a', label: '34 mm' },
      { id: 'b', label: '35 mm' },
      { id: 'c', label: '38 mm' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['none'],
    explanation:
      'Mini-jeux (page 47) : Le guide précise textuellement : « ...du diamètre de la balle officiel qui est de 36mm ». Aucune des options proposées n’est 36 mm, la réponse attendue est donc « Aucune de ces réponses » !',
  },
  {
    id: 18,
    page: 48,
    question:
      'Dans les règles impératives du mini-jeu « La Tournante » (page 48), quelles contraintes sont imposées ?',
    options: [
      { id: 'a', label: 'Créer obligatoirement des équipes de 4 joueurs par table' },
      { id: 'b', label: 'Changer obligatoirement de position tous les deux buts' },
      {
        id: 'c',
        label:
          'Les joueurs tournent obligatoirement dans le sens contraire des aiguilles d’une montre',
      },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['a', 'b', 'c'],
    explanation:
      'Mini-jeux (page 48) : « Créer obligatoirement des équipes de 4 joueurs par table. Le principe est de changer de position tous les deux buts. Les défenseurs prennent la place de l’attaquant et les attaquants prennent la place des défenseurs adversaires en tournant dans le sens contraire des aiguilles d’une montre ».',
  },
  {
    id: 19,
    page: 48,
    question:
      'Dans le mini-jeu « Guerre des goals » (page 48), comment maintient-on les barres des avants et des demis levées en l’air ?',
    options: [
      { id: 'a', label: 'À l’aide de bandes adhésives fixées aux paliers' },
      { id: 'b', label: 'À l’aide de tuyaux du diamètre des pieds des figurines' },
      { id: 'c', label: 'En utilisant des cales magnétiques sous les barres' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['b'],
    explanation:
      'Mini-jeux (page 48) : « Lever les barres avant et celles des demis (à l’aide de tuyau du diamètre des pieds des figurines). Le premier joueur arrivant à 5 a gagné ».',
  },
  {
    id: 20,
    page: 50,
    question:
      'Dans le « Jeu des 5 cartouches » (page 50), à quelles conditions précises dit-on textuellement que la « cartouche est morte » ?',
    options: [
      { id: 'a', label: 'Lorsque l’équipe (ou le joueur) qui défend bloque la balle' },
      { id: 'b', label: 'Si la balle n’est plus jouable ou si elle sort de la table' },
      { id: 'c', label: 'Dès que la balle touche le bois du fond sans entrer dans la cage' },
      { id: 'none', label: 'Aucune de ces réponses' },
    ],
    correctAnswers: ['a', 'b'],
    explanation:
      'Mini-jeux (page 50) : « La "cartouche est morte" lorsque l’équipe (ou le joueur) qui défend bloque la balle, si cette dernière n’est plus jouable, ou si elle sort de la table ». Les options A et B sont textuellement exactes.',
  },
]
