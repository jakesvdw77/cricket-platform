import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { at, makeGame } from '../../playerAvailability/testData'
import { SlotCoverageCard } from './SlotCoverageCard'
import type { SlotCoverage, TeamCoverage } from './slotCoverage'

const NAMES: Record<string, string> = { t1: 'Villagers 1', t2: 'Villagers 2' }
const PLAYERS = new Map(
  ['Abe de Villiers', 'Ben Stokes', 'Cal Root', 'Dan Lee', 'Eve Ray'].map((full, index) => {
    const [firstName, ...rest] = full.split(' ')
    return [`p${index + 1}`, { firstName, lastName: rest.join(' ') }] as const
  }),
)

function team(teamId: string, overrides: Partial<TeamCoverage> = {}): TeamCoverage {
  return { teamId, needed: 11, available: 13, ownOnly: 11, shared: 2, unsure: 0, hasPoll: true, ...overrides }
}

function makeSlot(overrides: Partial<SlotCoverage> = {}): SlotCoverage {
  return {
    key: '2026-10-17|AFTERNOON',
    date: new Date(2026, 9, 17),
    dayPart: 'AFTERNOON',
    games: [
      makeGame({ matchId: 'm1', label: 'Villagers 1 v CBC', matchDate: at(10, 17, 12) }),
      makeGame({ matchId: 'm2', label: 'Villagers 2 v Town', matchDate: at(10, 17, 13, 30) }),
    ],
    teams: [team('t2'), team('t1')],
    distinctAvailable: 24,
    placesNeeded: 22,
    sharedIds: ['p1', 'p2'],
    distinctUnsure: 0,
    status: 'COVERED',
    shortBy: 0,
    split: [],
    spare: 2,
    ...overrides,
  }
}

function renderCard(slot: SlotCoverage) {
  return render(<SlotCoverageCard slot={slot} teamName={(id) => NAMES[id] ?? 'Unknown team'} playersById={PLAYERS} />)
}

// MUI's useMediaQuery reads window.matchMedia; jsdom has none (so desktop wording by default).
function setPhone() {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  delete window.matchMedia
})

const TIGHT = () =>
  makeSlot({
    status: 'TIGHT',
    teams: [team('t1', { available: 15, ownOnly: 9, shared: 6 }), team('t2', { available: 14, ownOnly: 8, shared: 6 })],
    distinctAvailable: 23,
    sharedIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
    split: [
      { teamId: 't1', shortfall: 2 },
      { teamId: 't2', shortfall: 3 },
    ],
    spare: 1,
  })

describe('SlotCoverageCard (docs/specs/074 section 6)', () => {
  it('titles the slot "Sat 17 Oct · Afternoon"', () => {
    renderCard(makeSlot())
    expect(screen.getByRole('heading', { level: 3, name: 'Sat 17 Oct · Afternoon' })).toBeInTheDocument()
  })

  it.each([
    [makeSlot(), 'Covered', 'active'],
    [TIGHT(), 'Tight', 'season'],
    [makeSlot({ status: 'SHORT', shortBy: 5 }), 'Short by 5', 'closed'],
    [makeSlot({ status: 'NO_XI_SIZE' }), 'No XI size', 'muted'],
    [makeSlot({ status: 'NO_POLL' }), 'No poll yet', 'noPoll'],
  ] as const)('badges %# in words with its tone: %s', (slot, label, tone) => {
    renderCard(slot)
    const badge = screen.getByText(label)
    expect(badge.closest('[data-tone]')).toHaveAttribute('data-tone', tone)
    if (tone === 'noPoll') expect(badge.closest('.MuiChip-root')).toHaveClass('MuiChip-outlined')
  })

  it('reads the summary line with the numbers, and the shorter phone form', () => {
    const { unmount } = renderCard(makeSlot())
    expect(screen.getByTestId('slot-summary')).toHaveTextContent('24 distinct players available for 22 places')
    unmount()

    setPhone()
    renderCard(makeSlot())
    expect(screen.getByTestId('slot-summary')).toHaveTextContent('24 distinct players for 22 places')
  })

  it('uses singular forms, drops the places when not assessed, and says so when nobody is available', () => {
    const { unmount } = renderCard(makeSlot({ distinctAvailable: 1, placesNeeded: 1 }))
    expect(screen.getByTestId('slot-summary')).toHaveTextContent('1 distinct player available for 1 place')
    unmount()

    const second = renderCard(makeSlot({ status: 'NO_XI_SIZE', distinctAvailable: 23 }))
    expect(screen.getByTestId('slot-summary')).toHaveTextContent(/^23 distinct players available$/)
    second.unmount()

    renderCard(makeSlot({ distinctAvailable: 0 }))
    expect(screen.getByTestId('slot-summary')).toHaveTextContent('Nobody has said they are available yet')
  })

  it('shows one bar row per team in name order, with label, counts and the aria-label numbers', () => {
    renderCard(makeSlot())

    const bars = screen.getAllByRole('img')
    expect(bars.map((bar) => bar.getAttribute('aria-label'))).toEqual([
      'Villagers 1: 13 available, 11 only this team, 2 also available for another team, 11 needed',
      'Villagers 2: 13 available, 11 only this team, 2 also available for another team, 11 needed',
    ])
    expect(screen.getAllByText('13 available · 11 needed')).toHaveLength(2)
    expect(screen.getByText('Villagers 1')).toBeInTheDocument()
  })

  it('uses the short team figures on a phone', () => {
    setPhone()
    renderCard(makeSlot())
    expect(screen.getAllByText('13 · need 11')).toHaveLength(2)
  })

  it('reads "No poll yet · 11 needed" for a team with no poll, and shows no needed for an unknown XI size', () => {
    const { unmount } = renderCard(
      makeSlot({ status: 'NO_POLL', teams: [team('t1'), team('t2', { hasPoll: false, available: 0, ownOnly: 0, shared: 0 })] }),
    )
    expect(screen.getByText('No poll yet · 11 needed')).toBeInTheDocument()
    unmount()

    renderCard(makeSlot({ status: 'NO_XI_SIZE', teams: [team('t1'), team('t2', { needed: null })] }))
    expect(screen.queryByText(/needed/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('coverage-tick')).not.toBeInTheDocument()
    expect(screen.getAllByText(/13 available$/)).toHaveLength(2)
  })

  it('shows the hint box with an info icon for Tight and a warning icon for Short, and none otherwise', () => {
    const tight = renderCard(TIGHT())
    expect(screen.getByTestId('slot-hint')).toHaveTextContent(
      'Works only if the 5 shared players are split: 2 to Villagers 1, 3 to Villagers 2 (1 spare).',
    )
    expect(screen.getByTestId('InfoOutlinedIcon')).toBeInTheDocument()
    expect(screen.queryByTestId('WarningAmberOutlinedIcon')).not.toBeInTheDocument()
    tight.unmount()

    const short = renderCard(
      makeSlot({ status: 'SHORT', shortBy: 5, teams: [team('t1', { available: 11, ownOnly: 8, shared: 3 }), team('t2', { available: 9, ownOnly: 6, shared: 3 })] }),
    )
    expect(screen.getByTestId('slot-hint')).toHaveTextContent('Villagers 2 cannot reach 11 even with every shared player.')
    expect(screen.getByTestId('slot-hint')).toHaveTextContent('Chase 5 more players.')
    expect(screen.getByTestId('WarningAmberOutlinedIcon')).toBeInTheDocument()
    short.unmount()

    for (const status of ['COVERED', 'NO_XI_SIZE', 'NO_POLL'] as const) {
      const { unmount } = renderCard(makeSlot({ status }))
      expect(screen.queryByTestId('slot-hint')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('shortens the Tight hint on a phone', () => {
    setPhone()
    renderCard(TIGHT())
    expect(screen.getByTestId('slot-hint')).toHaveTextContent('Split the 5 shared players: 2 to Villagers 1, 3 to Villagers 2.')
  })

  it('lists the first three shared names then +N, which expands and collapses', async () => {
    const user = userEvent.setup()
    renderCard(TIGHT())

    const list = screen.getByRole('list', { name: 'Shared players' })
    expect(within(list).getByText('A. de Villiers')).toBeInTheDocument()
    expect(within(list).getByLabelText('Abe de Villiers')).toHaveAttribute('title', 'Abe de Villiers')
    expect(within(list).queryByText('D. Lee')).not.toBeInTheDocument()

    const more = within(list).getByRole('button', { name: '+2' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    await user.click(more)
    expect(within(list).getByText('D. Lee')).toBeInTheDocument()
    expect(within(list).getByText('E. Ray')).toBeInTheDocument()

    const fewer = within(list).getByRole('button', { name: 'Show fewer' })
    expect(fewer).toHaveAttribute('aria-expanded', 'true')
    await user.click(fewer)
    expect(within(list).queryByText('D. Lee')).not.toBeInTheDocument()
  })

  it('shows no +N when there are three or fewer shared players', () => {
    renderCard(makeSlot({ status: 'TIGHT', sharedIds: ['p1', 'p2'], split: [{ teamId: 't1', shortfall: 1 }], spare: 0 }))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows no chip row on a Covered card, but a shared-players count in the muted line', () => {
    renderCard(makeSlot())
    expect(screen.queryByRole('list', { name: 'Shared players' })).not.toBeInTheDocument()
    expect(screen.getByText('2 shared players')).toBeInTheDocument()
  })

  it('joins the muted parts and omits the line when empty', () => {
    const { unmount } = renderCard(makeSlot({ distinctUnsure: 3 }))
    expect(screen.getByText('2 shared players · 3 unsure answers (not counted)')).toBeInTheDocument()
    unmount()

    const singular = renderCard(makeSlot({ sharedIds: ['p1'], distinctUnsure: 1 }))
    expect(screen.getByText('1 shared player · 1 unsure answer (not counted)')).toBeInTheDocument()
    singular.unmount()

    renderCard(makeSlot({ sharedIds: [], distinctUnsure: 0 }))
    expect(screen.queryByText(/shared player|unsure/)).not.toBeInTheDocument()
  })

  it('says unsure answers could close part of, or the whole, gap on a Short card', () => {
    const base = { status: 'SHORT' as const, shortBy: 5, sharedIds: [] as string[] }
    const part = renderCard(makeSlot({ ...base, distinctUnsure: 4 }))
    expect(screen.getByText('4 unsure answers could close part of the gap')).toBeInTheDocument()
    part.unmount()

    renderCard(makeSlot({ ...base, distinctUnsure: 5 }))
    expect(screen.getByText('5 unsure answers could close the gap')).toBeInTheDocument()
  })

  it('lists the games in kickoff order with their kickoff times', () => {
    renderCard(makeSlot())
    const items = within(screen.getByRole('list', { name: 'Games' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['Villagers 1 v CBC12:00', 'Villagers 2 v Town13:30'])
  })
})
