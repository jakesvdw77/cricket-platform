import { describe, expect, it } from 'vitest'
import { teamMenuItems } from './teamMenuItems'

// docs/specs/142: the one ordered list of a team's actions for the card, the row and the Team page
describe('teamMenuItems', () => {
  it('lists Open Team, Edit Team, View Stats, then View Squad when there is an openTo', () => {
    const items = teamMenuItems({ openTo: '/o', editTo: '/e', statsTo: '/s' })
    expect(items.map((item) => item.title)).toEqual(['Open Team', 'Edit Team', 'View Stats', 'View Squad'])
  })

  it('leaves out Open Team and View Squad on the Team page itself (no openTo)', () => {
    expect(teamMenuItems({ editTo: '/e', statsTo: '/s' }).map((item) => item.title)).toEqual(['Edit Team', 'View Stats'])
  })

  it('links each item, with the squad as the #squad anchor of the team page', () => {
    const items = teamMenuItems({ openTo: '/o?returnTo=x', editTo: '/e', statsTo: '/s' })
    expect(items.map((item) => item.to)).toEqual(['/o?returnTo=x', '/e', '/s', '/o?returnTo=x#squad'])
  })

  it('has no error-toned or click-handler items (every action is a link)', () => {
    const items = teamMenuItems({ openTo: '/o', editTo: '/e', statsTo: '/s' })
    expect(items.some((item) => item.tone === 'error' || item.onClick)).toBe(false)
  })
})
