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

  it('puts the surname particles on the first-name line and the main surname in capitals on its own line, so a long surname fits', () => {
    const long = { ...model, players: [player('a', 'Jaco', 'Van der Westhuizen'), player('b', 'Emile', 'van der Merwe'), player('c', 'Anton', 'De Villiers')] }
    const { texts } = record(long, options)
    expect(texts).toEqual(expect.arrayContaining(['Jaco van der', 'WESTHUIZEN', 'Emile van der', 'MERWE', 'Anton de', 'VILLIERS']))
    expect(texts).not.toContain('VAN DER WESTHUIZEN')
  })

  it('shows the team\'s affiliation name under the team name when the switch is on and the team has one', () => {
    const named = { ...model, affiliationName: 'Titans Veterans' }
    expect(record(named, { ...options, include: { ...options.include, affiliationName: true } }).texts).toContain('Titans Veterans')
    expect(record(named, { ...options, include: { ...options.include, affiliationName: false } }).texts).not.toContain('Titans Veterans')
    expect(record(model, { ...options, include: { ...options.include, affiliationName: true } }).texts).not.toContain('Titans Veterans')
  })

  it('draws the heading you typed in capitals, and SQUAD when it is empty', () => {
    expect(record({ ...model, heading: 'VCASA Club Champs 2026' }, options).texts).toContain('VCASA CLUB CHAMPS 2026')
    expect(record({ ...model, heading: '   ' }, options).texts).toContain('SQUAD')
    expect(record(model, options).texts).toContain('SQUAD')
  })

  it('leaves out the season and player count line when its switch is off', () => {
    expect(record(model, options).texts).toContain('2026/2027 · 3 players')
    expect(record(model, { ...options, include: { ...options.include, subtitle: false } }).texts).not.toContain('2026/2027 · 3 players')
  })

  it('puts SQUAD on its own row above the team name, never over it, when there is no logo in the header', () => {
    const rows: { text: string; y: number }[] = []
    const ctx = {
      fillRect: vi.fn(), drawImage: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), arcTo: vi.fn(), arc: vi.fn(), closePath: vi.fn(), fill: vi.fn(),
      createLinearGradient: () => ({ addColorStop: vi.fn() }), measureText: (text: string) => ({ width: text.length * 6 }),
      fillText: (text: string, _x: number, y: number) => rows.push({ text: String(text), y }),
      font: '', fillStyle: '', textAlign: 'left', textBaseline: 'alphabetic',
    }
    drawSquadImage(ctx as unknown as CanvasRenderingContext2D, model, options)
    const label = rows.find((row) => row.text === 'SQUAD')
    const name = rows.find((row) => row.text === 'IRENE VETERANS')
    expect(label && name).toBeTruthy()
    // the name's top (its middle minus half the title height) is below the label's row
    expect((name as { y: number }).y).toBeGreaterThan((label as { y: number }).y + 30)
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
