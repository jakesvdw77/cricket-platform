import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchKeyFigures } from './MatchKeyFigures'
import type { MatchPoll } from '../../../api/matchApi'

const NOW = new Date('2026-10-09T12:00:00')
const valueOf = (id: string) => within(screen.getByTestId(id)).getByTestId('page-counter-value')
const base = {
  venue: 'Riverside Oval',
  leagueName: 'TVL Division 1 T20',
  seasonLabel: '2026/2027',
  pollsReady: true,
  polls: [] as MatchPoll[],
  pollClosesAt: null as string | null,
}
const squadPoll = (open: boolean): MatchPoll => ({ type: 'SQUAD', teamId: 't1', pollId: 'p1', roundId: null, open })
const renderFigures = (props: Partial<Parameters<typeof MatchKeyFigures>[0]> & { matchDate: string }) =>
  render(
    <MemoryRouter>
      <MatchKeyFigures {...base} {...props} />
    </MemoryRouter>,
  )

describe('MatchKeyFigures', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('shows the venue, league with season and the countdown as four static compact counters with no button', () => {
    renderFigures({ matchDate: '2026-10-15T07:15:00' })
    expect(valueOf('match-figure-venue')).toHaveTextContent('Riverside Oval')
    expect(valueOf('match-figure-league')).toHaveTextContent('TVL Division 1 T20')
    expect(screen.getByText('League · 2026/2027')).toBeInTheDocument()
    expect(screen.getByText(/in 5 days/)).toBeInTheDocument()
    expect(screen.getByTestId('match-key-figures').querySelectorAll('button')).toHaveLength(0)
    expect(screen.getByTestId('match-key-figures').querySelectorAll('a')).toHaveLength(0)
    expect(screen.queryByText('filter')).not.toBeInTheDocument()
  })

  it('turns the Starts counter amber within 24 hours', () => {
    const { unmount } = renderFigures({ matchDate: '2026-10-15T07:15:00' })
    const calm = getComputedStyle(valueOf('match-figure-starts')).color
    unmount()
    renderFigures({ matchDate: '2026-10-09T18:00:00' })
    expect(getComputedStyle(valueOf('match-figure-starts')).color).not.toBe(calm)
  })

  it('says Played once the result is published, and Awaiting Result when it has started without one, with no countdown', () => {
    const { unmount } = renderFigures({ matchDate: '2026-10-09T08:00:00', resultStatus: 'PUBLISHED' })
    expect(screen.getByText(/^Played/)).toBeInTheDocument()
    unmount()
    renderFigures({ matchDate: '2026-10-09T08:00:00' })
    expect(screen.getByText(/^Awaiting Result/)).toBeInTheDocument()
  })

  it('shows TBC for no venue and Friendly for no league', () => {
    renderFigures({ venue: null, leagueName: null, matchDate: '2026-10-15T07:15:00' })
    expect(valueOf('match-figure-venue')).toHaveTextContent('TBC')
    expect(valueOf('match-figure-league')).toHaveTextContent('Friendly')
  })

  // docs/specs/099-fields-directory.md and 130: with a field the Venue counter is the one clickable card.
  describe('Field counter', () => {
    const renderWithField = (status: 'VERIFIED' | 'UNVERIFIED' | 'REJECTED' | null, fieldTo?: string) =>
      renderFigures({ matchDate: '2026-10-15T07:15:00', playingAreaId: 'field-1', playingAreaVerificationStatus: status, fieldTo })

    it('links to the field page and is captioned Field for a verified field', () => {
      renderWithField('VERIFIED')
      expect(screen.getByTestId('match-figure-venue')).toHaveAttribute('href', '/manage/fixtures/fields/field-1')
      expect(screen.getByText('Field')).toBeInTheDocument()
      expect(valueOf('match-figure-venue')).toHaveTextContent('Riverside Oval')
    })

    it('carries the page as origin when given the link', () => {
      renderWithField('VERIFIED', '/manage/fixtures/fields/field-1?returnTo=%2Fmanage%2Ffixtures%2Fmatches%2Fm1')
      expect(screen.getByTestId('match-figure-venue')).toHaveAttribute('href', expect.stringContaining('returnTo='))
    })

    it('flags an unverified or rejected field in the caption', () => {
      const { unmount } = renderWithField('UNVERIFIED')
      expect(screen.getByText('Field · Unverified')).toBeInTheDocument()
      unmount()
      renderWithField('REJECTED')
      expect(screen.getByText('Field · Rejected')).toBeInTheDocument()
    })

    it('stays a plain static Venue card when the match has no field', () => {
      renderFigures({ matchDate: '2026-10-15T07:15:00' })
      expect(screen.getByText('Venue')).toBeInTheDocument()
      expect(screen.getByTestId('match-figure-venue')).not.toHaveAttribute('href')
    })
  })

  it('shows the poll as None, Open (with its close time) and Closed', () => {
    const { unmount } = renderFigures({ matchDate: '2026-10-15T07:15:00' })
    expect(valueOf('match-figure-poll')).toHaveTextContent('None')
    expect(screen.getByText('No Poll Yet')).toBeInTheDocument()
    unmount()

    const open = renderFigures({ matchDate: '2026-10-15T07:15:00', polls: [squadPoll(true)], pollClosesAt: '2026-10-14T18:00:00' })
    expect(valueOf('match-figure-poll')).toHaveTextContent('Open')
    expect(screen.getByText(/^Closes /)).toBeInTheDocument()
    open.unmount()

    const noClose = renderFigures({ matchDate: '2026-10-15T07:15:00', polls: [squadPoll(true)] })
    expect(screen.getByText('1 Poll')).toBeInTheDocument()
    noClose.unmount()

    renderFigures({ matchDate: '2026-10-15T07:15:00', polls: [squadPoll(false)] })
    expect(valueOf('match-figure-poll')).toHaveTextContent('Closed')
  })

  it('shows a dash for the poll until the polls have loaded', () => {
    renderFigures({ pollsReady: false, matchDate: '2026-10-15T07:15:00' })
    expect(valueOf('match-figure-poll')).toHaveTextContent('–')
  })
})
