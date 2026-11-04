import { describe, expect, it, vi } from 'vitest'
import { sideMenuItems } from './sideMenuItems'

const titles = (options: Parameters<typeof sideMenuItems>[0]) => sideMenuItems(options).map((item) => item.title)

describe('sideMenuItems', () => {
  const noop = vi.fn()

  it('row: Select Players, Announce Team, Share Team last', () => {
    expect(titles({ side: { status: 'READY_TO_ANNOUNCE', announced: false, sideId: 's1' }, selectTo: '/x', onAnnounce: noop, onShare: noop })).toEqual(['Select Players', 'Announce Team', 'Share Team'])
  })

  it('page: Select Players, Availability, Un-announce Team once announced, Share Team last', () => {
    expect(titles({ side: { status: 'ANNOUNCED', announced: true, sideId: 's1' }, selectTo: '/x', onAnnounce: noop, onUnannounce: noop, onShare: noop, onAvailability: noop })).toEqual(['Select Players', 'Availability', 'Un-announce Team', 'Share Team'])
  })

  it('Announce Team is disabled with a reason until the side is ready, and Share Team until it is announced', () => {
    const items = sideMenuItems({ side: { status: 'IN_PROGRESS', announced: false, sideId: 's1' }, selectTo: '/x', onAnnounce: noop, onShare: noop })
    const announce = items.find((item) => item.id === 'announce')
    const share = items.find((item) => item.id === 'share')
    expect(announce?.disabled).toBe(true)
    expect(announce?.reason).toBeTruthy()
    expect(share?.disabled).toBe(true)
    expect(share?.reason).toBe('Announce the team to share it.')
  })

  it('a side that does not exist yet cannot be announced, and a page can pass its own blocked reason', () => {
    const items = sideMenuItems({ side: { status: 'READY_TO_ANNOUNCE', announced: false, sideId: 's1' }, selectTo: '/x', onAnnounce: noop, announceBlockedReason: 'Pick a captain first.' })
    expect(items.find((item) => item.id === 'announce')?.reason).toBe('Pick a captain first.')
  })

  it('a row omits Announce Team once announced, and Share Team becomes available', () => {
    const items = sideMenuItems({ side: { status: 'ANNOUNCED', announced: true, sideId: 's1' }, selectTo: '/x', onAnnounce: noop, onShare: noop })
    expect(items.map((item) => item.id)).toEqual(['select-players', 'share'])
    expect(items[1].disabled).toBe(false)
  })
})
