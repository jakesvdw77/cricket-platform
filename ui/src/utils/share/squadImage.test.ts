import { describe, expect, it, vi } from 'vitest'
import { drawSquadImage, squadImageSize } from './squadImage'
import type { SquadImageOptions, SquadShareModel } from './squadImage'

// The squad poster: a team's squad for a season. Checked on what is really drawn, with a recording Canvas2D.
function record(model: SquadShareModel, options: SquadImageOptions) {
  const texts: string[] = []
  let arcs = 0
  const ctx = {
    fillRect: vi.fn(),
    fillText: (text: string) => texts.push(String(text)),
    drawImage: vi.fn(),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    measureText: (text: string) => ({ width: text.length * 6 }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    arc: () => {
      arcs += 1
    },
    closePath: vi.fn(),
    fill: vi.fn(),
    font: '',
    fillStyle: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  }
  drawSquadImage(ctx as unknown as CanvasRenderingContext2D, model, options)
  return { texts, arcs }
}

const player = (key: string, first: string, last: string, patch: Partial<SquadShareModel['players'][number]> = {}) => ({ key, firstName: first, lastName: last, shirt: null, captain: false, keeper: false, photoUrl: null, ...patch })
const model: SquadShareModel = {
  teamName: 'Irene Veterans',
  teamLogoUrl: null,
  seasonLabel: '2026/2027',
  players: [player('a', 'Andre', 'Botha', { shirt: 7, captain: true }), player('b', 'Brent', 'Hartley', { shirt: 1, keeper: true }), player('c', 'Charl', 'Venter')],
}
const options: SquadImageOptions = {
  size: 'PORTRAIT',
  template: 'CLUB_GREEN',
  colour: { main: '#1b5e3b', dark: '#0f3d27', contrastText: '#ffffff' },
  layout: 'GRID',
  include: { shirtNumbers: true, marks: true, playerPictures: true },
  logos: { clubUrl: null, teamAffiliationUrl: null, teamLogo: false, sponsorUrls: [] },
  images: new Map(),
  footerLine: false,
}

describe('drawSquadImage', () => {
  it('is 1080 wide and as tall as the chosen size', () => {
    expect(squadImageSize('SQUARE')).toEqual({ width: 1080, height: 1080 })
    expect(squadImageSize('PORTRAIT')).toEqual({ width: 1080, height: 1350 })
    expect(squadImageSize('STORY')).toEqual({ width: 1080, height: 1920 })
  })

  it('draws the team, the season with the player count, and every player as first name and SURNAME in a grid', () => {
    const { texts } = record(model, options)
    expect(texts).toContain('IRENE VETERANS')
    expect(texts).toContain('SQUAD')
    expect(texts).toContain('2026/2027 · 3 players')
    for (const name of ['Andre', 'BOTHA', 'Brent', 'HARTLEY', 'Charl', 'VENTER']) expect(texts).toContain(name)
  })

  it('shows the shirt numbers and the captain and keeper marks, and leaves them out when switched off', () => {
    const on = record(model, options).texts
    expect(on).toEqual(expect.arrayContaining(['7', '1', 'C', 'WK']))
    const off = record(model, { ...options, include: { shirtNumbers: false, marks: false, playerPictures: true } }).texts
    expect(off).not.toContain('7')
    expect(off).not.toContain('WK')
  })

  it('draws a number disc for each player instead of a picture when Player Pictures is off', () => {
    const withPictures = record(model, options).arcs
    const without = record(model, { ...options, include: { ...options.include, playerPictures: false } })
    expect(without.arcs).toBeGreaterThan(0)
    expect(without.texts).toEqual(expect.arrayContaining(['7', '1']))
    expect(withPictures).toBeGreaterThan(0)
  })

  it('lists full names with numbers and marks in the List layout', () => {
    const { texts } = record(model, { ...options, layout: 'LIST' })
    expect(texts).toEqual(expect.arrayContaining(['Andre Botha (C)', 'Brent Hartley (WK)', 'Charl Venter']))
  })

  it('says so when the squad is empty, and counts a single player in the singular', () => {
    expect(record({ ...model, players: [] }, options).texts).toContain('No players in this squad yet')
    expect(record({ ...model, players: [model.players[0]] }, options).texts).toContain('2026/2027 · 1 player')
  })

  it('draws a squad of 25 on every size without throwing', () => {
    const many = { ...model, players: Array.from({ length: 25 }, (_, index) => player(`p${index}`, `First${index}`, `Last${index}`, { shirt: index + 1 })) }
    for (const size of ['SQUARE', 'PORTRAIT', 'STORY'] as const) {
      for (const layout of ['GRID', 'LIST'] as const) {
        expect(() => record(many, { ...options, size, layout, textScale: 1.6 })).not.toThrow()
      }
    }
  })
})
