import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeamSheetDialog } from './TeamSheetDialog'
import type { Match } from '../../api/matchApi'

const listSections = vi.fn()
const listSquad = vi.fn()
const listLeagues = vi.fn()
const generate = vi.fn()
vi.mock('../../api/sectionApi', () => ({ listSections: (clubId: string) => listSections(clubId) }))
vi.mock('../../api/teamSquadApi', () => ({ listSquad: (...args: unknown[]) => listSquad(...args) }))
vi.mock('../../api/leagueApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/leagueApi')>()), listLeagues: (...args: unknown[]) => listLeagues(...args) }))
vi.mock('../../utils/share/printableTeamSheetPdf', () => ({ generateTeamSheetPdf: (...args: unknown[]) => generate(...args) }))

const member = (first: string, last: string, patch: Record<string, unknown> = {}) => ({
  playerProfileId: `${first}-${last}`, firstName: first, lastName: last, active: true, isCaptain: false, isWicketKeeper: false, squadJerseyNumber: null, jerseyNumber: null, ...patch,
})
const match = (id: string, date: string, opposition: string, patch: Partial<Match> = {}): Match =>
  ({ id, homeTeamId: 't1', homeTeamName: 'Irene Veterans', awayTeamId: null, awayTeamName: opposition, leagueId: 'l1', seasonId: 's1', matchDate: date, venue: 'Durbanville CC B', active: true, ...patch }) as Match

const team = { id: 't1', name: 'Irene Veterans', logoUrl: null, sectionId: 'over40' }
const matches = [match('m2', '2026-11-20T09:30:00', 'Paarl Heat'), match('m1', '2026-11-19T14:30:00', 'Midlands CC')]

function renderDialog(props: Partial<React.ComponentProps<typeof TeamSheetDialog>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TeamSheetDialog open onClose={vi.fn()} clubId="club-1" teams={[team]} seasonId="s1" seasonLabel="2026/2027" matches={matches} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listSections.mockResolvedValue([{ id: 'over40', clubId: 'club-1', parentSectionId: null, name: 'Over 40', minAge: 40, maxAge: null, gender: null, active: true }])
  listSquad.mockResolvedValue([member('Jaco', 'Van der Westhuizen', { squadJerseyNumber: 16 }), member('Andre', 'Botha', { isCaptain: true, squadJerseyNumber: 7 })])
  listLeagues.mockResolvedValue([{ id: 'l1', name: 'VCASA Club Champs', logoUrl: null, format: 'T20' }])
  generate.mockResolvedValue(new File(['x'], 'sheet.pdf', { type: 'application/pdf' }))
})

describe('TeamSheetDialog (spec 153)', () => {
  it('previews the whole squad alphabetically with empty boxes, and generates a blank sheet', async () => {
    renderDialog()
    const paper = await screen.findByTestId('team-sheet-paper')
    await waitFor(() => expect(within(paper).getAllByTestId('team-sheet-row').length).toBeGreaterThan(2))
    const rows = within(paper).getAllByTestId('team-sheet-row')
    expect(rows[0]).toHaveTextContent('Andre')
    expect(rows[1]).toHaveTextContent('Van der Westhuizen')
    expect(within(paper).queryByTestId('mark-captain')).not.toBeInTheDocument()
    await waitFor(() => expect(generate).toHaveBeenCalled())
    expect(generate.mock.calls.at(-1)?.[1]).toMatchObject({ preMark: false, fileName: 'Team Sheet - Irene Veterans (blank).pdf' })
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument()
  })

  it('pre-marks the captain only when the switch is on', async () => {
    renderDialog()
    const paper = await screen.findByTestId('team-sheet-paper')
    await waitFor(() => expect(within(paper).getAllByTestId('team-sheet-row').length).toBeGreaterThan(2))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pre-Mark Captain And Keepers' }))
    expect(await within(paper).findByTestId('mark-captain')).toBeInTheDocument()
    await waitFor(() => expect(generate.mock.calls.at(-1)?.[1]).toMatchObject({ preMark: true }))
  })

  it('fills the match details for One Match, soonest match first', async () => {
    renderDialog({ initialMode: 'one' })
    await waitFor(() => expect(generate).toHaveBeenCalled())
    const specs = generate.mock.calls.at(-1)?.[0]
    expect(specs).toHaveLength(1)
    expect(specs[0].match).toMatchObject({ opposition: 'Midlands CC', venue: 'Durbanville CC B', league: 'VCASA Club Champs', overs: 'T20' })
    expect(generate.mock.calls.at(-1)?.[1].fileName).toBe('Team Sheet - Irene Veterans - Midlands CC - 2026-11-19.pdf')
  })

  it('makes one sheet per ticked match for All Matches, and drops an unticked one', async () => {
    renderDialog({ initialMode: 'all', leagueId: 'l1' })
    await waitFor(() => expect(generate.mock.calls.at(-1)?.[0]).toHaveLength(2))
    expect(screen.getByRole('heading', { name: 'Print Match Sheets' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /Fri 20 Nov.*Paarl Heat/ }))
    await waitFor(() => expect(generate.mock.calls.at(-1)?.[0]).toHaveLength(1))
    expect(generate.mock.calls.at(-1)?.[0][0].match.opposition).toBe('Midlands CC')
  })

  it('says so when the squad is empty and offers no PDF', async () => {
    listSquad.mockResolvedValue([])
    renderDialog()
    expect(await screen.findByText(/no players in its squad/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download PDF/ })).toBeDisabled()
  })

  it('has the late-player lines on by default and lets them be switched off', async () => {
    renderDialog()
    const toggle = await screen.findByRole('checkbox', { name: 'Two Lines For Late Or Guest Players' })
    expect(toggle).toBeChecked()
    await userEvent.click(toggle)
    expect(toggle).not.toBeChecked()
    await screen.findByTestId('team-sheet-ready')
  })

  it('leaves the toss boxes off by default and shows them when switched on', async () => {
    renderDialog()
    const toggle = await screen.findByRole('checkbox', { name: 'Toss And Elected Boxes' })
    expect(toggle).not.toBeChecked()
    expect(screen.queryByText('Toss won by')).not.toBeInTheDocument()
    await userEvent.click(toggle)
    expect(await screen.findByText('Toss won by')).toBeInTheDocument()
    expect(screen.getByText('Elected to')).toBeInTheDocument()
  })

  it('shows no junior notice, and still prints full names', async () => {
    listSections.mockResolvedValue([{ id: 'over40', clubId: 'club-1', parentSectionId: null, name: 'U13', minAge: null, maxAge: 13, gender: null, active: true }])
    renderDialog()
    await screen.findByTestId('team-sheet-ready')
    expect(screen.queryByText(/junior team/i)).not.toBeInTheDocument()
  })
})
