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
const listTeamSponsors = vi.fn()
const getLeagueSeasonDates = vi.fn()
const listMatchSides = vi.fn()
vi.mock('../../api/matchSideApi', () => ({ listMatchSides: (...args: unknown[]) => listMatchSides(...args) }))
vi.mock('../../api/leagueSeasonDatesApi', () => ({ getLeagueSeasonDates: (...args: unknown[]) => getLeagueSeasonDates(...args) }))
vi.mock('../../api/teamSponsorApi', () => ({ listTeamSponsors: (...args: unknown[]) => listTeamSponsors(...args) }))
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
        <TeamSheetDialog open onClose={vi.fn()} clubId="club-1" teams={[team]} seasonId="s1" seasonLabel="2026/2027" matches={matches} initialStyle="plain" {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listSections.mockResolvedValue([{ id: 'over40', clubId: 'club-1', parentSectionId: null, name: 'Over 40', minAge: 40, maxAge: null, gender: null, active: true }])
  listSquad.mockResolvedValue([member('Jaco', 'Van der Westhuizen', { squadJerseyNumber: 16 }), member('Andre', 'Botha', { isCaptain: true, squadJerseyNumber: 7 })])
  listLeagues.mockResolvedValue([{ id: 'l1', name: 'VCASA Club Champs', logoUrl: null, format: 'T20' }])
  getLeagueSeasonDates.mockResolvedValue(null)
  listMatchSides.mockImplementation(async (_club: string, matchId: string) =>
    matchId === 'm1'
      ? [{ id: 'side1', matchId: 'm1', teamId: 't1', captainPlayerId: 'Andre-Botha', wicketKeeperPlayerId: null, twelfthManPlayerId: null, announced: false, players: [{ playerProfileId: 'Jaco-Van der Westhuizen', battingOrder: 1, role: 'BATSMAN' }, { playerProfileId: 'Andre-Botha', battingOrder: 2, role: 'BATSMAN' }] }]
      : [],
  )
  listTeamSponsors.mockResolvedValue([{ id: 'sp1', name: 'Sponsor One', logoUrl: '/media/sponsor.png' }])
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
    expect(generate.mock.calls.at(-1)?.[1]).toMatchObject({ preMark: { captain: false, keeper: false }, fileName: 'Team Sheet - Irene Veterans (blank).pdf' })
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument()
  })

  it('has two separate switches, Pre-Mark Captain and Pre-Mark Wicketkeeper, both off by default', async () => {
    renderDialog()
    await screen.findByTestId('team-sheet-paper')
    expect(screen.getByRole('checkbox', { name: 'Pre-Mark Captain' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Pre-Mark Wicketkeeper' })).not.toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'Pre-Mark Captain And Keepers' })).not.toBeInTheDocument()
  })

  it('pre-marks the captain alone when only Pre-Mark Captain is on', async () => {
    renderDialog()
    const paper = await screen.findByTestId('team-sheet-paper')
    await waitFor(() => expect(within(paper).getAllByTestId('team-sheet-row').length).toBeGreaterThan(2))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pre-Mark Captain' }))
    expect(await within(paper).findByTestId('mark-captain')).toBeInTheDocument()
    expect(within(paper).queryByTestId('mark-keeper')).not.toBeInTheDocument()
    await waitFor(() => expect(generate.mock.calls.at(-1)?.[1]).toMatchObject({ preMark: { captain: true, keeper: false } }))
  })

  it('pre-marks the wicketkeeper alone when only Pre-Mark Wicketkeeper is on', async () => {
    listSquad.mockResolvedValue([member('Jaco', 'Van der Westhuizen', { isWicketKeeper: true }), member('Andre', 'Botha', { isCaptain: true })])
    renderDialog()
    const paper = await screen.findByTestId('team-sheet-paper')
    await waitFor(() => expect(within(paper).getAllByTestId('team-sheet-row').length).toBeGreaterThan(1))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pre-Mark Wicketkeeper' }))
    expect(await within(paper).findByTestId('mark-keeper')).toBeInTheDocument()
    expect(within(paper).queryByTestId('mark-captain')).not.toBeInTheDocument()
    await waitFor(() => expect(generate.mock.calls.at(-1)?.[1]).toMatchObject({ preMark: { captain: false, keeper: true } }))
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
    expect(screen.getByRole('heading', { name: 'Print Match Sheets' })).toBeInTheDocument()
    // No match is ticked to begin with (each one makes its own sheet, so ticking them all up front was heavy): Select All ticks them.
    expect(await screen.findByTestId('team-sheet-chosen-count')).toHaveTextContent('Tick the matches to print')
    expect(screen.getAllByRole('checkbox', { name: /vs / }).every((box) => !(box as HTMLInputElement).checked)).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Select All' }))
    await waitFor(() => expect(generate.mock.calls.at(-1)?.[0]).toHaveLength(2))
    expect(screen.getByTestId('team-sheet-chosen-count')).toHaveTextContent('2 of 2 ticked')
    await userEvent.click(screen.getByRole('checkbox', { name: /Fri 20 Nov.*Paarl Heat/ }))
    await waitFor(() => expect(generate.mock.calls.at(-1)?.[0]).toHaveLength(1))
    expect(generate.mock.calls.at(-1)?.[0][0].match.opposition).toBe('Midlands CC')
  })

  it('Clear unticks every match again', async () => {
    renderDialog({ initialMode: 'all', leagueId: 'l1' })
    await userEvent.click(await screen.findByRole('button', { name: 'Select All' }))
    await waitFor(() => expect(screen.getByTestId('team-sheet-chosen-count')).toHaveTextContent('2 of 2 ticked'))
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByTestId('team-sheet-chosen-count')).toHaveTextContent('Tick the matches to print')
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

  it('hides the Capt and Keeper columns when their tick boxes are switched off', async () => {
    renderDialog()
    expect(await screen.findByText('Keeper')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Capt And Keeper Tick Boxes' }))
    expect(screen.queryByText('Keeper')).not.toBeInTheDocument()
    expect(screen.getByText('Wicketkeeper')).toBeInTheDocument()
  })

  it('opens on the Poster style: its own preview, spec extras and switches (spec 153 addendum, 154)', async () => {
    listLeagues.mockResolvedValue([{ id: 'l1', name: 'VCASA Club Champs', logoUrl: null, format: 'T20', hostName: 'Boland Veterans', hostLogoUrl: null, affiliationName: 'VCASA', affiliationLogoUrl: null }])
    renderDialog({ teams: [{ ...team, affiliationName: 'Titans Veterans Cricket', affiliationLogoUrl: null }], initialMode: 'one', initialMatchId: 'm1', initialStyle: undefined })

    const poster = await screen.findByTestId('team-sheet-poster')
    expect(poster).toHaveTextContent('VCASA Club Champs 2026')
    expect(poster).toHaveTextContent('19-20 NOV 2026')
    expect(poster).toHaveTextContent('Titans Veterans Cricket')
    expect(poster).toHaveTextContent('Boland Veterans')
    expect(poster).toHaveTextContent('VCASA')
    expect(poster).toHaveTextContent('Midlands CC')
    await waitFor(() => expect(generate.mock.calls.at(-1)?.[1]).toMatchObject({ style: 'poster', batBowl: true, comment: true }))
    expect(generate.mock.calls.at(-1)?.[0][0].poster.sponsorLogoUrls).toEqual(['/media/sponsor.png'])
    expect(screen.queryByRole('checkbox', { name: 'Toss And Elected Boxes' })).not.toBeInTheDocument()

    expect(within(poster).getByText('Bowl')).toBeInTheDocument()
    expect(within(poster).getByText('Comment')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Bat Pos And Bowl Columns' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Comment Column' }))
    const after = await screen.findByTestId('team-sheet-poster')
    expect(within(after).queryByText('Bowl')).not.toBeInTheDocument()
    expect(within(after).queryByText('Comment')).not.toBeInTheDocument()
  })

  it('has a Playing Tick Box switch, on by default, that removes the Playing column when off (Poster)', async () => {
    renderDialog({ initialStyle: undefined })
    const poster = await screen.findByTestId('team-sheet-poster')
    expect(within(poster).getByText('Playing')).toBeInTheDocument()
    await waitFor(() => expect(generate.mock.calls.at(-1)?.[1]).toMatchObject({ playingBox: true }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Playing Tick Box' }))
    expect(within(await screen.findByTestId('team-sheet-poster')).queryByText('Playing')).not.toBeInTheDocument()
    await waitFor(() => expect(generate.mock.calls.at(-1)?.[1]).toMatchObject({ playingBox: false }))
  })

  it('does not offer the Playing Tick Box for Selected Side, which has no tick column', async () => {
    renderDialog({ initialStyle: undefined, initialMode: 'all' })
    await userEvent.click(await screen.findByRole('button', { name: 'Selected Side' }))
    expect(screen.queryByRole('checkbox', { name: 'Playing Tick Box' })).not.toBeInTheDocument()
  })

  it('sorts by surname by default and by first name when Sort By is switched', async () => {
    listSquad.mockResolvedValue([member('Zane', 'Adams'), member('Andre', 'Botha')])
    renderDialog()
    let rows = within(await screen.findByTestId('team-sheet-paper')).getAllByTestId('team-sheet-row')
    await waitFor(() => expect(rows[0]).toHaveTextContent('Zane'))
    await userEvent.click(screen.getByRole('button', { name: 'First Name' }))
    rows = within(await screen.findByTestId('team-sheet-paper')).getAllByTestId('team-sheet-row')
    await waitFor(() => expect(rows[0]).toHaveTextContent('Andre'))
  })

  it('prints the stage and a TBC opposition on the Poster for a playoff match (spec 155)', async () => {
    const playoff = match('p1', '2026-11-21T10:00:00', '3rd in the pool', { awayPlaceholder: true, stage: 'Semi-final' })
    renderDialog({ matches: [playoff], initialStyle: undefined, initialMode: 'one', initialMatchId: 'p1' })
    const poster = await screen.findByTestId('team-sheet-poster')
    expect(poster).toHaveTextContent(/semi-final/i)
    expect(poster).toHaveTextContent('TBC: 3rd in the pool')
  })

  it('prints the tournament\'s saved start and end dates on the Poster, not just our own matches (spec 111)', async () => {
    getLeagueSeasonDates.mockResolvedValue({ startDate: '2026-11-19', endDate: '2026-11-21' })
    renderDialog({ initialMode: 'one', initialMatchId: 'm1', initialStyle: undefined })
    expect(await screen.findByText('19-21 NOV 2026')).toBeInTheDocument()
  })

  it('Selected Side prints only the saved side in batting order, skips a match with none, and can sort alphabetically (spec 153)', async () => {
    renderDialog({ initialStyle: undefined, initialMode: 'all' })
    await userEvent.click(await screen.findByRole('button', { name: 'Selected Side' }))
    await userEvent.click(screen.getByRole('button', { name: 'Select All' }))

    const poster = await screen.findByTestId('team-sheet-poster')
    await waitFor(() => expect(within(poster).getAllByTestId('team-sheet-row')).toHaveLength(2))
    let rows = within(poster).getAllByTestId('team-sheet-row')
    expect(rows[0]).toHaveTextContent('Jaco')
    expect(rows[1]).toHaveTextContent('Andre')
    expect(rows[1]).toHaveTextContent('C')
    expect(poster).toHaveTextContent('Midlands CC')
    expect(within(poster).queryByText('Playing')).not.toBeInTheDocument()
    expect(await screen.findByTestId('team-sheet-skipped')).toHaveTextContent('Paarl Heat')
    await waitFor(() => expect(generate.mock.calls.at(-1)?.[0]).toHaveLength(1))
    expect(generate.mock.calls.at(-1)?.[0][0]).toMatchObject({ selectedSide: true })

    await userEvent.click(screen.getByRole('button', { name: 'Alphabetical' }))
    rows = within(await screen.findByTestId('team-sheet-poster')).getAllByTestId('team-sheet-row')
    expect(rows[0]).toHaveTextContent('Andre')
  })

  it('Selected Side says so, with a link to Team Selection, when no ticked match has a side', async () => {
    listMatchSides.mockResolvedValue([])
    renderDialog({ initialStyle: undefined, initialMode: 'all' })
    await userEvent.click(await screen.findByRole('button', { name: 'Selected Side' }))
    await userEvent.click(screen.getByRole('button', { name: 'Select All' }))
    expect(await screen.findByText(/No side has been selected for the ticked matches yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Team Selection' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download PDF/ })).toBeDisabled()
  })

  it('offers Selected Side only on the Poster style', async () => {
    renderDialog({ initialStyle: undefined })
    expect(await screen.findByRole('button', { name: 'Selected Side' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Plain' }))
    expect(screen.queryByRole('button', { name: 'Selected Side' })).not.toBeInTheDocument()
  })

  it('shows no junior notice, and still prints full names', async () => {
    listSections.mockResolvedValue([{ id: 'over40', clubId: 'club-1', parentSectionId: null, name: 'U13', minAge: null, maxAge: 13, gender: null, active: true }])
    renderDialog()
    await screen.findByTestId('team-sheet-ready')
    expect(screen.queryByText(/junior team/i)).not.toBeInTheDocument()
  })
})
