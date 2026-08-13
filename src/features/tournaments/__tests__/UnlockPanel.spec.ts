import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import UnlockPanel from '../components/UnlockPanel.vue'
import { DeviceUnlocks } from '../unlocks'
import { hashPassphrase } from '../domain/passphrase'
import type { Tournament } from '../domain/types'

const PASSPHRASE = 'babyfoot du mardi'
/** Cost 4: the rampart is bcrypt's slowness, and a test suite does not need it. */
const TEST_COST = 4

const OTHER_EDITION = 'edition-b'

async function edition(): Promise<Tournament> {
  return {
    id: 1,
    publicId: 'edition-a',
    label: 'HandiTournoi',
    startDate: '2026-08-13',
    status: 'round-robin',
    passphraseHash: await hashPassphrase(PASSPHRASE, TEST_COST),
    createdAt: Date.now(),
  }
}

/** Submits, then waits for bcrypt to have had its say rather than for a tick. */
async function typeAndSubmit(tournament: Tournament, passphrase: string) {
  const panel = mount(UnlockPanel, { props: { tournament } })

  await panel.get('input').setValue(passphrase)
  await panel.get('form').trigger('submit')

  await vi.waitFor(() => {
    expect(panel.get('button[type="submit"]').text()).not.toContain('Vérification')
  })
  await panel.vm.$nextTick()

  return panel
}

describe('UnlockPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('refuses a wrong passphrase and leaves the edition locked', async () => {
    const tournament = await edition()

    const panel = await typeAndSubmit(tournament, 'pas la bonne du tout')

    expect(panel.emitted('unlocked')).toBeUndefined()
    expect(panel.get('[role="alert"]').text()).toContain('refusée')
    expect(new DeviceUnlocks(localStorage).isUnlocked(tournament.publicId)).toBe(false)
  })

  it('unlocks on the right passphrase, checked against the local verifier alone', async () => {
    const tournament = await edition()

    const panel = await typeAndSubmit(tournament, PASSPHRASE)

    expect(panel.emitted('unlocked')).toHaveLength(1)
    expect(panel.find('[role="alert"]').exists()).toBe(false)
  })

  it('remembers the unlock for that edition, so a reload does not ask again', async () => {
    const tournament = await edition()

    await typeAndSubmit(tournament, PASSPHRASE)

    expect(new DeviceUnlocks(localStorage).isUnlocked(tournament.publicId)).toBe(true)
    expect(new DeviceUnlocks(localStorage).isUnlocked(OTHER_EDITION)).toBe(false)
  })

  it('takes the passphrase a mobile keyboard finished with a space', async () => {
    const tournament = await edition()

    const panel = await typeAndSubmit(tournament, ` ${PASSPHRASE} `)

    expect(panel.emitted('unlocked')).toHaveLength(1)
  })
})
