import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RulesView from '../RulesView.vue'

describe('RulesView', () => {
  function mountRules() {
    return mount(RulesView, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    })
  }

  it('renders the header title and description', () => {
    const wrapper = mountRules()
    expect(wrapper.find('h1').text()).toContain('Règles Officielles & Arbitrage')
    expect(wrapper.text()).toContain('FFFT')
  })

  it('renders the interactive out-of-bounds solver with passive block selected by default', () => {
    const wrapper = mountRules()
    const text = wrapper.text()
    expect(text).toContain('Contre passif (Ricochet défensif)')
    expect(text).toContain('Balle au défenseur')
    expect(text).toContain('Aux arrières du défenseur (l’équipe qui subissait le tir)')
  })

  it('updates the decision when another scenario is selected', async () => {
    const wrapper = mountRules()
    const buttons = wrapper.findAll('button')
    const activeBlockBtn = buttons.find((b) => b.text().includes('Contre actif'))
    expect(activeBlockBtn).toBeDefined()

    await activeBlockBtn?.trigger('click')

    expect(wrapper.text()).toContain('Balle à l’attaquant')
    expect(wrapper.text()).toContain('Aux arrières de l’attaquant (l’équipe adverse du défenseur)')
  })

  it('renders the myth debunking section with pissette, gamelle and roulette', () => {
    const wrapper = mountRules()
    const text = wrapper.text()
    expect(text).toContain('La pissette est interdite !')
    expect(text).toContain('100% LÉGALE')
    expect(text).toContain('Le but des demis')
    expect(text).toContain('COMPTE POUR 1 BUT')
    expect(text).toContain('Toute roulette est formellement interdite !')
    expect(text).toContain('AUTORISÉE SI ≤ 360°')
    expect(text).toContain('Une gamelle enlève un point')
  })

  it('filters content when searching', async () => {
    const wrapper = mountRules()
    const searchInput = wrapper.find('input[type="search"]')
    expect(searchInput.exists()).toBe(true)

    await searchInput.setValue('pissette')

    expect(wrapper.text()).toContain('La pissette est interdite !')
    expect(wrapper.text()).not.toContain('Dégagement défensif qui sort du terrain')
  })

  it('toggles tabs to display only specific sections', async () => {
    const wrapper = mountRules()
    const tabs = wrapper.findAll('nav button')
    const mythsTab = tabs.find((t) => t.text().includes('Vrai ou Faux'))
    expect(mythsTab).toBeDefined()

    await mythsTab?.trigger('click')

    expect(wrapper.find('#myths').exists()).toBe(true)
    expect(wrapper.find('#out-of-bounds').exists()).toBe(false)
    expect(wrapper.find('#official-rules').exists()).toBe(false)
    expect(wrapper.find('#handibaby').exists()).toBe(false)
  })
})
