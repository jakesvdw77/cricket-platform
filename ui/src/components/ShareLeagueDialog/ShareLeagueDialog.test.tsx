import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { League } from '../../api/leagueApi'
import { leagueSeasonDatesKey } from '../../api/leagueSeasonDatesApi'
import { leagueTeamsQueryKey } from '../../api/leagueTeamApi'
import { resultsKey } from '../../api/matchResultApi'
import { shareSettingsKey } from '../../api/shareSettingsApi'
import { baseTheme } from '../../theme'
import type { LeagueContent } from '../../utils/share/leagueShareFormats'
import { ShareLeagueDialog } from './ShareLeagueDialog'

// docs/specs/122-league-sharing.md (ShareLeagueDialog): every read is answered from a seeded cache (no server), so the
// gaps are real: this league has teams, a schedule and key dates, but no playing conditions and no published results.
const league = { id: 'league-1', clubId: 'club-1', name: 'Summer Premier League', maxAge: 40, minAge: null, format: null, logoUrl: null, phone: '011 555 0100', email: null, website: null, socialLinks: [], active: true } as unknown as League

function seeded(disabledFormats: Record<string, string[]> = {}, extra: { conditions?: unknown; results?: unknown[] } = {}): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  const set = (key: readonly unknown[], value: unknown) => client.setQueryData(key, value)
  set(shareSettingsKey('club-1'), { initialsOnlyDefault: false, disabledFormats })
  set(['managed-club', 'club-1', 'seasons'], [{ id: 's1', label: '2026/27', startDate: '2026-11-01', endDate: '2027-03-31', active: true }])
  set(['managed-club', 'club-1', 'teams'], [{ id: 't1', clubId: 'club-1', sectionId: 'sec-1', name: 'Riverside 1', logoUrl: null, abbreviation: null, active: true }])
  set(['managed-club', 'club-1', 'leagues', 'league-1', 'affiliations'], [{ id: 'a1', leagueId: 'league-1', teamId: 't1', seasonId: 's1' }])
  set(['managed-club', 'club-1', 'leagues', 'league-1', 'contacts'], [
    { id: 'k1', leagueId: 'league-1', contact: { firstName: 'Thabo', lastName: 'Mokoena', email: 't@example.org', phone: '082 555 0199' }, role: 'Convenor', isPrimary: true, active: true },
  ])
  set([...leagueTeamsQueryKey('club-1', 'league-1', 's1'), 'active'], [{ id: 'lt1', name: 'Hilltop', abbreviation: null, logoUrl: null, active: true }])
  set(['managed-club', 'club-1', 'leagues', 'league-1', 'matches', 's1'], [
    { id: 'm1', homeTeamId: 't1', homeTeamName: 'Riverside 1', awayTeamId: null, awayTeamName: 'Hilltop', matchDate: '2026-11-14T14:00:00', venue: 'Main oval', active: true },
  ])
  set([...resultsKey('club-1'), 'league-published', 'league-1', 's1'], extra.results ?? [])
  set(leagueSeasonDatesKey('club-1', 'league-1', 's1'), { startDate: '2026-11-01', endDate: '2027-03-31' })
  set(['managed-club', 'club-1', 'leagues', 'league-1', 'playing-conditions', 's1'], extra.conditions ?? null)
  set(['managed-club', 'club-1', 'sections'], [{ id: 'sec-1', parentSectionId: null, name: 'Seniors', maxAge: null }])
  set(['managed-club', 'club-1', 'profile'], { name: 'Riverside CC', logoUrl: null, website: null })
  set(['managed-club', 'club-1', 'sponsors'], [])
  return client
}

function Harness({ client, preselected, onClose }: { client: QueryClient; preselected: LeagueContent[]; onClose: () => void }) {
  return (
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={client}>
        <ShareLeagueDialog open onClose={onClose} clubId="club-1" league={league} seasonId="s1" preselected={preselected} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

const renderDialog = (preselected: LeagueContent[], options: { disabledFormats?: Record<string, string[]>; onClose?: () => void } = {}) =>
  render(<Harness client={seeded(options.disabledFormats)} preselected={preselected} onClose={options.onClose ?? (() => {})} />)

const box = (label: string) => screen.getByRole('checkbox', { name: new RegExp(`^${label}`) })
const next = () => userEvent.click(screen.getByRole('button', { name: 'Next' }))

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('step 1, What to share', () => {
  it('ticks what the League card entry point preselects', async () => {
    renderDialog(['DETAILS', 'SCHEDULE'])
    expect(await screen.findByRole('status')).toHaveTextContent('2 selected')
    expect(box('League details')).toBeChecked()
    expect(box('Schedule')).toBeChecked()
    expect(box('Teams')).not.toBeChecked()
    expect(box('Key dates')).not.toBeChecked()
  })

  it('ticks only Playing conditions from the conditions tab entry point, but not when the season has none', async () => {
    const { unmount } = render(<Harness client={seeded({}, { conditions: { maxOversPerInnings: 20, powerplayOvers: 6, allowSubstitutions: true, freeHitOnNoBall: true } })} preselected={['CONDITIONS']} onClose={() => {}} />)
    await screen.findByText('1 selected')
    expect(box('Playing conditions')).toBeChecked()
    expect(box('League details')).not.toBeChecked()
    unmount()

    renderDialog(['CONDITIONS'])
    expect(await screen.findByText('Tick at least one thing to share')).toBeInTheDocument()
    expect(box('Playing conditions')).toBeDisabled()
    expect(box('Playing conditions')).not.toBeChecked()
  })

  it('lists a content with nothing to share greyed, with its reason', async () => {
    renderDialog(['DETAILS'])
    await screen.findByText('1 selected')
    expect(box('Playing conditions')).toBeDisabled()
    expect(screen.getByText('No playing conditions set for this season yet')).toBeInTheDocument()
    expect(box('Results')).toBeDisabled()
    expect(screen.getByText('No published results for this season yet')).toBeInTheDocument()
    expect(box('Teams')).toBeEnabled()
  })

  it('blocks Next with nothing ticked and allows it again after ticking', async () => {
    renderDialog(['DETAILS'])
    await screen.findByText('1 selected')
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()

    await userEvent.click(box('League details'))
    expect(screen.getByText('Tick at least one thing to share')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    await userEvent.click(box('Teams'))
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('has a Close button that closes the dialog', async () => {
    const onClose = vi.fn()
    renderDialog(['DETAILS'], { onClose })
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('step 2, Output format', () => {
  it('offers a format when any ticked content supports it and greys the rest with a reason', async () => {
    renderDialog(['DETAILS'])
    await screen.findByText('1 selected')
    await next()

    expect(screen.getByRole('radio', { name: /PDF/ })).toBeEnabled()
    expect(screen.getByRole('radio', { name: /WhatsApp/ })).toBeEnabled()
    expect(screen.getByRole('radio', { name: /Facebook/ })).toBeEnabled()
    expect(screen.getByRole('radio', { name: /Poster/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Poster/ })).toHaveTextContent('Needs Teams, Schedule or Key dates ticked')
    expect(screen.getByRole('radio', { name: /Calendar/ })).toHaveTextContent('Needs Schedule or Key dates ticked')
  })

  it('offers the Calendar once a schedule is ticked alongside content it cannot carry', async () => {
    renderDialog(['DETAILS', 'SCHEDULE'])
    await screen.findByText('2 selected')
    await next()
    expect(screen.getByRole('radio', { name: /Calendar/ })).toBeEnabled()
    expect(screen.getByRole('radio', { name: /Poster/ })).toBeEnabled()
  })

  it('does not show a format the club switched off', async () => {
    renderDialog(['DETAILS', 'SCHEDULE'], { disabledFormats: { LEAGUE: ['FACEBOOK', 'CALENDAR'] } })
    await screen.findByText('2 selected')
    await next()
    expect(screen.queryByRole('radio', { name: /Facebook/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Calendar/ })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /WhatsApp/ })).toBeInTheDocument()
  })

  it('says so when every format is switched off', async () => {
    renderDialog(['DETAILS'], { disabledFormats: { LEAGUE: ['PDF', 'POSTER', 'CALENDAR', 'WHATSAPP', 'FACEBOOK'] } })
    await screen.findByText('1 selected')
    await next()
    expect(screen.getByText(/No share format is switched on for leagues/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('keeps the ticks when going Back', async () => {
    renderDialog(['DETAILS', 'SCHEDULE'])
    await screen.findByText('2 selected')
    await userEvent.click(box('Teams'))
    await next()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(box('League details')).toBeChecked()
    expect(box('Schedule')).toBeChecked()
    expect(box('Teams')).toBeChecked()
    expect(box('Key dates')).not.toBeChecked()
  })

  it('remembers the contents and format for next time, per club', async () => {
    renderDialog(['TEAMS'])
    await screen.findByText('1 selected')
    await next()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    await next()
    await screen.findByRole('textbox', { name: 'Message text' })

    const stored = JSON.parse(localStorage.getItem('share:choices:club-1') as string)
    expect(stored.league.contents).toEqual(['TEAMS'])
    expect(stored.league.format).toBe('WHATSAPP')
  })
})

describe('format screen', () => {
  it('shows a Close button and the left-out note for a content the format cannot carry', async () => {
    renderDialog(['DETAILS', 'SCHEDULE'])
    await screen.findByText('2 selected')
    await next()
    await userEvent.click(screen.getByRole('radio', { name: /Calendar/ }))
    await next()

    expect(await screen.findByRole('note')).toHaveTextContent('League details is not included in a calendar.')
    // The header icon and the pinned footer button.
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('gives no note when the format carries everything ticked', async () => {
    renderDialog(['DETAILS', 'SCHEDULE'])
    await screen.findByText('2 selected')
    await next()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    await next()
    await screen.findByRole('textbox', { name: 'Message text' })
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('leaves phone and email out of the text until opted in, and the opt-in is not remembered', async () => {
    const client = seeded()
    const view = render(<Harness client={client} preselected={['DETAILS']} onClose={() => {}} />)
    await screen.findByText('1 selected')
    await next()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    await next()
    const text = () => (screen.getByRole('textbox', { name: 'Message text' }) as HTMLTextAreaElement).value
    await screen.findByRole('textbox', { name: 'Message text' })
    expect(text()).not.toContain('082 555 0199')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Include phone and email' }))
    expect(text()).toContain('082 555 0199')
    expect(localStorage.getItem('share:choices:club-1')?.toLowerCase() ?? '').not.toContain('contact')

    view.unmount()
    render(<Harness client={client} preselected={['DETAILS']} onClose={() => {}} />)
    await screen.findByText('1 selected')
    await next()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    await next()
    await screen.findByRole('textbox', { name: 'Message text' })
    expect(screen.getByRole('checkbox', { name: 'Include phone and email' })).not.toBeChecked()
    expect(text()).not.toContain('082 555 0199')
  })

  it('writes the contact in the shortened form for a junior league and locks the switch on', async () => {
    const client = seeded()
    render(
      <ThemeProvider theme={baseTheme}>
        <QueryClientProvider client={client}>
          <ShareLeagueDialog open onClose={() => {}} clubId="club-1" league={{ ...league, maxAge: 13 }} seasonId="s1" preselected={['DETAILS']} />
        </QueryClientProvider>
      </ThemeProvider>,
    )
    await screen.findByText('1 selected')
    await next()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    await next()
    const message = (await screen.findByRole('textbox', { name: 'Message text' })) as HTMLTextAreaElement
    expect(message.value).toContain('Convenor: T. Mokoena')
    expect(message.value).not.toContain('Thabo')
    expect(screen.getByRole('checkbox', { name: 'First names as initials' })).toBeDisabled()
    expect(within(screen.getByRole('dialog')).getByText('Always on for junior leagues')).toBeInTheDocument()
  })
})
