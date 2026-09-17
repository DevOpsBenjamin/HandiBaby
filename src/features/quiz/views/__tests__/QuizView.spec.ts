import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import QuizView from '../QuizView.vue'
import { useQuizStore } from '../../stores/quiz'
import { usePlayerPoolStore } from '@/features/players/stores/pool'
import { db } from '@/core/container'

let mockRoute = { params: {} as Record<string, string>, query: {} as Record<string, string> }

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => mockRoute,
  }
})

describe('QuizView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    mockRoute = { params: {}, query: {} }
    await db.quizAttempts.clear()
    await db.players.clear()
  })

  function mountQuiz() {
    return mount(QuizView, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    })
  }

  it('renders start screen with warning and disabled start button when vivier is empty', () => {
    const wrapper = mountQuiz()
    expect(wrapper.find('h1').text()).toContain('Le Grand Quiz Pédagogique FFFT')
    expect(wrapper.text()).toContain('Le Vivier est actuellement vide')

    const startBtn = wrapper.find('#start-quiz-btn')
    expect(startBtn.attributes('disabled')).toBeDefined()
  })

  it('enables start button when a vivier player is selected and transitions to question 1', async () => {
    const pool = usePlayerPoolStore()
    await pool.add('Jean-Eudes', 'Dupont')

    const wrapper = mountQuiz()
    await vi.waitFor(() => {
      expect(wrapper.find('select#player-select').exists()).toBe(true)
    })

    const select = wrapper.find('select#player-select')
    await select.setValue('jean-eudes dupont')
    await wrapper.vm.$nextTick()

    const startBtn = wrapper.find('#start-quiz-btn')
    expect(startBtn.attributes('disabled')).toBeUndefined()
    expect(startBtn.text()).toContain('Jean-Eudes Dupont')

    await startBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Question 1 / 20')
    expect(wrapper.text()).toContain('Victime :')
    expect(wrapper.text()).toContain('Jean-Eudes Dupont')
  })

  it('supports selecting and toggling options including none mutually exclusively', async () => {
    const wrapper = mountQuiz()
    const quizStore = useQuizStore()
    quizStore.startQuiz('Jean-Eudes')
    await wrapper.vm.$nextTick()

    const optionButtons = wrapper.findAll('.quiz-option-btn')
    expect(optionButtons.length).toBe(4) // 3 options + 1 none

    // Click option A
    await optionButtons[0]?.trigger('click')
    expect(quizStore.answers[1]).toEqual(['a'])

    // Click option C
    await optionButtons[2]?.trigger('click')
    expect(quizStore.answers[1]).toEqual(['a', 'c'])

    // Click option none ('Aucune de ces réponses')
    await optionButtons[3]?.trigger('click')
    expect(quizStore.answers[1]).toEqual(['none'])

    // Click option A again: should clear 'none' and set 'a'
    await optionButtons[0]?.trigger('click')
    expect(quizStore.answers[1]).toEqual(['a'])
  })

  it('navigates across questions with next and prev buttons', async () => {
    const wrapper = mountQuiz()
    const quizStore = useQuizStore()
    quizStore.startQuiz('Jean-Eudes')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Question 1 / 20')

    const nextBtn = wrapper.findAll('button').find((b) => b.text().includes('Question suivante'))
    await nextBtn?.trigger('click')

    expect(wrapper.text()).toContain('Question 2 / 20')

    const prevBtn = wrapper.findAll('button').find((b) => b.text().includes('Question précédente'))
    await prevBtn?.trigger('click')

    expect(wrapper.text()).toContain('Question 1 / 20')
  })

  it('submits quiz, displays review mode, and copies share link', async () => {
    const clipboardWriteMock = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteMock,
      },
    })

    const wrapper = mountQuiz()
    const quizStore = useQuizStore()
    quizStore.startQuiz('Jean-Eudes')
    await wrapper.vm.$nextTick()

    // Answer Q1 with only ['a'] (incomplete since ['a', 'c'] is expected) -> 0 pts
    quizStore.toggleAnswer(1, 'a')

    // Submit quiz
    const submitBtn = wrapper.findAll('button').find((b) => b.text().includes('Valider'))
    await submitBtn?.trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Score officiel de Jean-Eudes')
    })

    expect(wrapper.text()).toContain('0 / 20')
    expect(wrapper.text()).toContain('Le néant absolu')
    expect(wrapper.text()).toContain('Correction intégrale des 20 questions')
    expect(wrapper.text()).toContain('Choix incomplet (2 réponses requises)')

    // Share button
    const shareBtn = wrapper.find('#share-quiz-btn')
    expect(shareBtn.exists()).toBe(true)
    expect(shareBtn.text()).toContain('Partager le lien dans le chat HandiBaby')

    await shareBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(clipboardWriteMock).toHaveBeenCalledWith(
      expect.stringContaining(`/quiz/resultat/${quizStore.currentAttemptPublicId}`),
    )
    expect(shareBtn.text()).toContain('Lien copié dans le presse-papier !')
  })

  it('loads shared attempt directly when route publicId param is provided', async () => {
    // Add existing attempt in db
    await db.quizAttempts.add({
      publicId: 'uuid-target-share',
      candidateName: 'Camarade Bully',
      score: 1,
      totalQuestions: 20,
      answers: { 2: ['b'] },
      completedAt: 1700000000000,
    })

    mockRoute = { params: { publicId: 'uuid-target-share' }, query: {} }

    const wrapper = mountQuiz()

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Score officiel de Camarade Bully')
    })

    expect(wrapper.text()).toContain('1 / 20')
    expect(wrapper.text()).toContain('🔗 Résultat partagé synchronisé avec Supabase')
  })
})
