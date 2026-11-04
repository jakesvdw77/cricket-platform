import { describe, expect, it, vi } from 'vitest'
import { playerMenuItems } from './playerMenuItems'
import type { PlayerStatus } from './playerStatus'

// docs/specs/141: the one ordered list of a player's actions for the card, the row and the Player page
const build = (status: PlayerStatus, openTo?: string) =>
  playerMenuItems({ status, openTo, editTo: '/e', statsTo: '/s', onStatusAction: vi.fn() })

describe('playerMenuItems', () => {
  it.each([
    ['verified', ['Open Player', 'Edit Player', 'View Stats', 'Suspend Player']],
    ['unverified', ['Open Player', 'Edit Player', 'View Stats', 'Verify Player', 'Reject Player']],
    ['rejected', ['Open Player', 'Edit Player', 'View Stats', 'Verify Player']],
    ['suspended', ['Open Player', 'Edit Player', 'View Stats', 'Reactivate Player']],
  ] as const)('lists %s in order', (status, titles) => {
    expect(build(status, '/o').map((item) => item.title)).toEqual(titles)
  })

  it('leaves out Open Player on the Player page (no openTo)', () => {
    expect(build('verified').map((item) => item.title)).toEqual(['Edit Player', 'View Stats', 'Suspend Player'])
  })

  it('links Open, Edit and View Stats, and runs the status action on click', () => {
    const onStatusAction = vi.fn()
    const items = playerMenuItems({ status: 'unverified', openTo: '/o', editTo: '/e', statsTo: '/s', onStatusAction })
    expect(items.slice(0, 3).map((item) => item.to)).toEqual(['/o', '/e', '/s'])
    items.find((item) => item.id === 'reject')?.onClick?.()
    expect(onStatusAction).toHaveBeenCalledWith('reject')
  })

  it('draws only Reject and Suspend in the error tone', () => {
    expect(build('unverified').filter((item) => item.tone === 'error').map((item) => item.id)).toEqual(['reject'])
    expect(build('verified').filter((item) => item.tone === 'error').map((item) => item.id)).toEqual(['suspend'])
    expect(build('suspended').some((item) => item.tone === 'error')).toBe(false)
  })
})
