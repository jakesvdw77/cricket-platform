import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchCandidate } from '../../../../api/resultImportApi'
import { formatMatchDateTime } from '../../../../utils/matchDateTime'
import { jsonAdaptor, makeCandidate, makeCatalogue, makePreview, renderImportPage } from './importTestUtils'

const getImportCatalogue = vi.fn()
const previewImport = vi.fn()
const createMatch = vi.fn()
const deleteMatch = vi.fn()
const listMatches = vi.fn()
const listSections = vi.fn()
const updateMatchDateTime = vi.fn()

vi.mock('../../../../api/resultImportApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../api/resultImportApi')>()
  return {
    ...actual,
    getImportCatalogue: (clubId: string) => getImportCatalogue(clubId),
    previewImport: (clubId: string, request: unknown, file?: File | null) => previewImport(clubId, request, file),
  }
})
// The Add match dialog's own data.
vi.mock('../../../../api/matchApi', () => ({
  createMatch: (clubId: string, payload: unknown) => createMatch(clubId, payload),
  deleteMatch: (clubId: string, matchId: string) => deleteMatch(clubId, matchId),
  listMatches: (clubId: string, params: unknown) => listMatches(clubId, params),
  updateMatchDateTime: (clubId: string, matchId: string, matchDate: string) => updateMatchDateTime(clubId, matchId, matchDate),
}))
vi.mock('../../../../api/sectionApi', () => ({ listSections: () => listSections() }))
vi.mock('../../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([{ id: 'team-1', name: 'Strollers A', sectionId: 'sec-1' }]) }))
vi.mock('../../../../api/seasonApi', () => ({ listSeasons: () => Promise.resolve([]) }))
vi.mock('../../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([{ id: 'league-1', name: 'Saturday League' }]) }))
vi.mock('../../../../api/leagueAffiliationApi', () => ({ listLeagueAffiliations: () => Promise.resolve([]) }))
vi.mock('../../../../api/leagueTeamApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../../api/leagueTeamApi')>()), listLeagueTeams: () => Promise.resolve([]) }))
vi.mock('../../../../api/meApi', () => ({ activateSession: () => Promise.resolve({ personId: null, personStatus: null, platformAdmin: false, clubAdminClubIds: [] }) }))

const second = (overrides: Partial<MatchCandidate> = {}) =>
  makeCandidate({ matchId: 'match-2', homeName: 'Northgate Strollers', awayName: 'Hilltop Wanderers', matchDate: new Date(2026, 9, 18, 13, 0).toISOString(), reasons: ['TEAMS'], ...overrides })

const found = (overrides: Record<string, unknown> = {}) => ({
  id: 'match-9',
  homeTeamId: 'team-1',
  homeTeamName: 'Northgate Strollers',
  awayTeamId: null,
  awayTeamName: 'Lakeside Rovers',
  matchDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  leagueId: 'league-1',
  resultStatus: 'NONE',
  ...overrides,
})
const page = (content: unknown[], totalElements = content.length) => ({ content, totalElements, totalPages: 1, number: 0, size: 8 })

beforeEach(() => {
  vi.clearAllMocks()
  getImportCatalogue.mockResolvedValue(makeCatalogue([jsonAdaptor]))
  previewImport.mockResolvedValue(makePreview())
  listMatches.mockResolvedValue(page([]))
  listSections.mockResolvedValue([{ id: 'sec-1', clubId: 'club-1', parentSectionId: null, name: 'Seniors', active: true }, { id: 'sec-2', clubId: 'club-1', parentSectionId: null, name: 'Juniors', active: true }])
})

// Gets to the Match step with the given preview.
async function toMatchStep(search = '') {
  const user = userEvent.setup()
  renderImportPage(search)
  await user.click(await screen.findByRole('tab', { name: 'Paste' }))
  await user.click(screen.getByLabelText('Pasted result content'))
  await user.paste('{}')
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByText('Which match is this?')
  return user
}

const matches = () => within(screen.getByRole('radiogroup', { name: 'Match' }))
const next = () => screen.getByRole('button', { name: 'Next' })

describe('Match step', () => {
  it('summarises what the file says', async () => {
    await toMatchStep()
    const summary = within(screen.getByTestId('import-file-summary'))
    expect(summary.getByText('11 Oct 2026, 13:00')).toBeInTheDocument()
    expect(summary.getByText('Northgate Strollers v Riverside Occasionals')).toBeInTheDocument()
    expect(summary.getByText('ACMESCORE, 4411')).toBeInTheDocument()
    expect(summary.getAllByText(/Northgate Strollers won by 24 runs/).length).toBeGreaterThan(0)
  })

  it('shows why each candidate was offered, in words', async () => {
    previewImport.mockResolvedValue(makePreview({ matchCandidates: [makeCandidate({ reasons: ['EXTERNAL_ID', 'DATE', 'TEAMS'] }), second({ reasons: ['VENUE', 'COMPETITION'] })] }))
    await toMatchStep()

    const first = within(matches().getByRole('radio', { name: /Riverside Occasionals/ }))
    expect(first.getByText('External id')).toBeInTheDocument()
    expect(first.getByText('Date')).toBeInTheDocument()
    expect(first.getByText('Teams')).toBeInTheDocument()
    const other = within(matches().getByRole('radio', { name: /Hilltop Wanderers/ }))
    expect(other.getByText('Venue')).toBeInTheDocument()
    expect(other.getByText('League')).toBeInTheDocument()
  })

  it('flags a match with no team of the club before the manager continues', async () => {
    previewImport.mockResolvedValue(makePreview({ matchCandidates: [makeCandidate({ homeIsClubTeam: false, awayIsClubTeam: false }), second()] }))
    await toMatchStep()
    expect(matches().getByText('Neither team is yours. Edit the match first')).toBeInTheDocument()
  })

  it('preselects nothing when there are several candidates, and Next waits for a choice', async () => {
    previewImport.mockResolvedValue(makePreview({ matchCandidates: [makeCandidate(), second({ matchDate: new Date(2026, 9, 11, 15, 0).toISOString() })] }))
    const user = await toMatchStep()

    expect(matches().getAllByRole('radio').every((radio) => radio.getAttribute('aria-checked') === 'false')).toBe(true)
    expect(next()).toBeDisabled()

    await user.click(matches().getByRole('radio', { name: /Hilltop Wanderers/ }))
    expect(next()).toBeEnabled()
  })

  it('preselects the only candidate', async () => {
    await toMatchStep()
    expect(matches().getByRole('radio', { name: /Riverside Occasionals/ })).toHaveAttribute('aria-checked', 'true')
    expect(next()).toBeEnabled()
  })

  it('preselects the match the wizard was opened from, and sends it with the preview', async () => {
    previewImport.mockResolvedValue(makePreview({ matchCandidates: [makeCandidate(), second()] }))
    await toMatchStep('?matchId=match-2')

    expect(matches().getByRole('radio', { name: /Hilltop Wanderers/ })).toHaveAttribute('aria-checked', 'true')
    expect(previewImport).toHaveBeenCalledWith('club-1', expect.objectContaining({ matchId: 'match-2' }), null)
  })

  it('warns when the match it was opened from does not look like the file, and not when it does', async () => {
    previewImport.mockResolvedValue(makePreview({ matchCandidates: [makeCandidate(), second({ reasons: ['DATE'] })] }))
    await toMatchStep('?matchId=match-2')
    expect(screen.getByText("The file's teams do not look like the sides of the match you chose.")).toBeInTheDocument()
  })

  it('does not warn when the launched match fits on date and teams', async () => {
    previewImport.mockResolvedValue(makePreview({ matchCandidates: [makeCandidate(), second()] }))
    await toMatchStep('?matchId=match-1')
    expect(screen.queryByText(/do not look like the sides/)).not.toBeInTheDocument()
  })

  it('badges a match that already has a result, in words', async () => {
    previewImport.mockResolvedValue(
      makePreview({
        matchCandidates: [
          makeCandidate({ existingResult: { matchId: 'match-1', status: 'DRAFT', source: 'MANUAL', hasScorecard: false, updatedAt: '2026-10-12T10:00:00Z' } }),
          second({ existingResult: { matchId: 'match-2', status: 'PUBLISHED', source: 'MANUAL', hasScorecard: false, updatedAt: '2026-10-12T10:00:00Z' } }),
          makeCandidate({ matchId: 'match-3', awayName: 'Parkside Casuals', reasons: ['DATE'] }),
        ],
      }),
    )
    await toMatchStep()

    expect(within(matches().getByRole('radio', { name: /Riverside Occasionals/ })).getByText('Draft result exists')).toBeInTheDocument()
    expect(within(matches().getByRole('radio', { name: /Hilltop Wanderers/ })).getByText('Published. Unpublish it first')).toBeInTheDocument()
    expect(within(matches().getByRole('radio', { name: /Parkside Casuals/ })).queryByText(/result exists|Published|Imported/)).not.toBeInTheDocument()
  })

  it('badges the match the same provider id was imported onto before', async () => {
    previewImport.mockResolvedValue(
      makePreview({
        existingForExternalId: { matchId: 'match-1', status: 'DRAFT', source: 'IMPORT:ACMESCORE', hasScorecard: true, updatedAt: '2026-10-12T10:00:00Z' },
        matchCandidates: [makeCandidate({ existingResult: { matchId: 'match-1', status: 'DRAFT', source: 'IMPORT:ACMESCORE', hasScorecard: true, updatedAt: '2026-10-12T10:00:00Z' } })],
      }),
    )
    await toMatchStep()
    expect(screen.getByText('Imported from this id before')).toBeInTheDocument()
  })

  it('cannot choose a published match: its tile is disabled and nothing is preselected from it', async () => {
    const published = { matchId: 'match-1', status: 'PUBLISHED' as const, source: 'MANUAL', hasScorecard: false, updatedAt: '2026-10-12T10:00:00Z' }
    previewImport.mockResolvedValue(makePreview({ matchCandidates: [makeCandidate({ existingResult: published })] }))
    await toMatchStep('?matchId=match-1')

    expect(matches().getByRole('radio', { name: /Riverside Occasionals/ })).toBeDisabled()
    expect(matches().getByRole('radio', { name: /Riverside Occasionals/ })).toHaveAttribute('aria-checked', 'false')
    expect(next()).toBeDisabled()
  })

  it('with no candidate shows an empty state whose button opens the Add match dialog prefilled from the file', async () => {
    previewImport.mockResolvedValue(makePreview({ matchCandidates: [] }))
    const user = await toMatchStep()

    expect(screen.getByText('No match in your fixtures looks like this file.')).toBeInTheDocument()
    expect(next()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Add match' }))

    const dialog = await screen.findByRole('dialog', { name: 'Add a match' })
    expect(within(dialog).getByText(/Filled in from the file/)).toBeInTheDocument()
    expect(await within(dialog).findByLabelText('Home opponent name')).toHaveValue('Northgate Strollers')
    expect(within(dialog).getByLabelText('Away opponent name')).toHaveValue('Riverside Occasionals')
  })

  it('offers to add a match that is not listed, even when there are candidates', async () => {
    previewImport.mockResolvedValue(makePreview({ matchCandidates: [makeCandidate(), second()] }))
    const user = await toMatchStep()
    await user.click(screen.getByRole('button', { name: 'Match not listed? Add the match first' }))
    expect(await screen.findByRole('dialog', { name: 'Add a match' })).toBeInTheDocument()
  })

  describe('a file date far from the chosen match', () => {
    // The file says 11 Oct; this match is a week later.
    const far = () => makePreview({ matchCandidates: [second({ reasons: ['TEAMS'] })] })

    it('warns with both days, asks for a tick, and Next stays disabled until it is given', async () => {
      previewImport.mockResolvedValue(far())
      const user = await toMatchStep()

      expect(screen.getByText('The file says 11 Oct 2026 but this match is on 18 Oct 2026.')).toBeInTheDocument()
      const tick = screen.getByRole('checkbox', { name: 'I have checked this is the right match' })
      expect(tick).not.toBeChecked()
      expect(next()).toBeDisabled()

      await user.click(tick)
      expect(next()).toBeEnabled()
    })

    it('shows no warning and asks for nothing when the dates are one day apart', async () => {
      previewImport.mockResolvedValue(makePreview({ matchCandidates: [second({ matchDate: new Date(2026, 9, 12, 13, 0).toISOString() })] }))
      await toMatchStep()
      expect(screen.queryByRole('checkbox', { name: 'I have checked this is the right match' })).not.toBeInTheDocument()
      expect(next()).toBeEnabled()
    })

    it('asks again when a different match is chosen: the tick resets', async () => {
      previewImport.mockResolvedValue(
        makePreview({ matchCandidates: [second({ matchId: 'match-2', awayName: 'Hilltop Wanderers' }), second({ matchId: 'match-3', awayName: 'Parkside Casuals', matchDate: new Date(2026, 9, 25, 13, 0).toISOString() })] }),
      )
      const user = await toMatchStep()

      await user.click(matches().getByRole('radio', { name: /Hilltop Wanderers/ }))
      await user.click(screen.getByRole('checkbox', { name: 'I have checked this is the right match' }))
      expect(next()).toBeEnabled()

      await user.click(matches().getByRole('radio', { name: /Parkside Casuals/ }))
      expect(screen.getByRole('checkbox', { name: 'I have checked this is the right match' })).not.toBeChecked()
      expect(next()).toBeDisabled()
    })
  })

  // docs/specs/118 UI requirement 7: the chosen match's date and time, editable before the manager confirms.
  describe('Edit date and time (118)', () => {
    const editDialog = () => screen.findByRole('dialog', { name: 'Edit date and time' })
    // Sets the dialog's date and time (local) and saves; the server answers with the match at that date.
    async function changeTo(user: Awaited<ReturnType<typeof toMatchStep>>, matchId: string, date: string, time: string) {
      updateMatchDateTime.mockResolvedValue({ id: matchId, matchDate: new Date(`${date}T${time}`).toISOString() })
      await user.click(screen.getByRole('button', { name: 'Edit date and time' }))
      const dialog = await editDialog()
      fireEvent.change(within(dialog).getByLabelText('Match date & time (date)'), { target: { value: date } })
      fireEvent.change(within(dialog).getByLabelText('Match date & time (time)'), { target: { value: time } })
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit date and time' })).not.toBeInTheDocument())
    }

    it('shows the chosen match\'s date and time beside what the file says, with an Edit date and time button', async () => {
      await toMatchStep()
      const line = screen.getByTestId('import-match-date')
      expect(line).toHaveTextContent('This match is on')
      expect(line).toHaveTextContent(formatMatchDateTime(new Date(2026, 9, 11, 13, 0).toISOString()))
      expect(within(line).getByRole('button', { name: 'Edit date and time' })).toBeEnabled()
    })

    it('shows nothing to edit until a match is chosen', async () => {
      previewImport.mockResolvedValue(makePreview({ matchCandidates: [makeCandidate(), second({ matchDate: new Date(2026, 9, 11, 15, 0).toISOString() })] }))
      await toMatchStep()
      expect(screen.queryByTestId('import-match-date')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Edit date and time' })).not.toBeInTheDocument()
    })

    it('saves only the date and time of the chosen match, and the line shows the new time', async () => {
      const user = await toMatchStep()
      await changeTo(user, 'match-1', '2026-10-11', '15:30')
      expect(updateMatchDateTime).toHaveBeenCalledWith('club-1', 'match-1', new Date('2026-10-11T15:30').toISOString())
      expect(screen.getByTestId('import-match-date')).toHaveTextContent(formatMatchDateTime(new Date('2026-10-11T15:30').toISOString()))
      expect(updateMatchDateTime).toHaveBeenCalledTimes(1)
    })

    it('recomputes the date check: moving a far match onto the file\'s day removes the warning and the tick', async () => {
      previewImport.mockResolvedValue(makePreview({ matchCandidates: [second({ reasons: ['TEAMS'] })] }))
      const user = await toMatchStep()
      expect(screen.getByRole('checkbox', { name: 'I have checked this is the right match' })).toBeInTheDocument()
      expect(next()).toBeDisabled()

      await changeTo(user, 'match-2', '2026-10-11', '13:00')

      expect(screen.queryByText(/The file says/)).not.toBeInTheDocument()
      expect(screen.queryByRole('checkbox', { name: 'I have checked this is the right match' })).not.toBeInTheDocument()
      expect(next()).toBeEnabled()
    })

    it('still asks for the tick, with the new day in the warning, while a difference remains', async () => {
      previewImport.mockResolvedValue(makePreview({ matchCandidates: [second({ reasons: ['TEAMS'] })] }))
      const user = await toMatchStep()

      await changeTo(user, 'match-2', '2026-10-25', '13:00')

      expect(screen.getByText('The file says 11 Oct 2026 but this match is on 25 Oct 2026.')).toBeInTheDocument()
      const tick = screen.getByRole('checkbox', { name: 'I have checked this is the right match' })
      expect(tick).not.toBeChecked()
      expect(next()).toBeDisabled()
      await user.click(tick)
      expect(next()).toBeEnabled()
    })

    it('starts asking when an edit moves a matching match away from the file\'s day', async () => {
      const user = await toMatchStep()
      expect(screen.queryByText(/The file says/)).not.toBeInTheDocument()

      await changeTo(user, 'match-1', '2026-10-20', '13:00')

      expect(screen.getByText('The file says 11 Oct 2026 but this match is on 20 Oct 2026.')).toBeInTheDocument()
      expect(next()).toBeDisabled()
    })

    it('never confirms the import: the wizard stays on the Match step and nothing else is sent', async () => {
      const user = await toMatchStep()
      const previews = previewImport.mock.calls.length
      await changeTo(user, 'match-1', '2026-10-11', '15:30')

      expect(screen.getByText('Which match is this?')).toBeInTheDocument()
      expect(screen.queryByText('Which side is which?')).not.toBeInTheDocument()
      expect(previewImport).toHaveBeenCalledTimes(previews)
    })

    it('keeps the dialog open and the line unchanged when the league dates refuse the change', async () => {
      const error = Object.assign(new Error('bad'), { isAxiosError: true, response: { status: 400, data: { code: 'MATCH_OUTSIDE_LEAGUE_DATES', detail: 'This league runs from 1 Sep to 31 Jul.' } } })
      updateMatchDateTime.mockRejectedValue(error)
      const user = await toMatchStep()
      await user.click(screen.getByRole('button', { name: 'Edit date and time' }))
      const dialog = await editDialog()
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))
      expect(await within(dialog).findByText('This league runs from 1 Sep to 31 Jul.')).toBeInTheDocument()
      expect(screen.getByTestId('import-match-date')).toHaveTextContent(formatMatchDateTime(new Date(2026, 9, 11, 13, 0).toISOString()))
    })
  })

  it('has Back (filled) on the left and Next (filled) in the shared wizard footer', async () => {
    await toMatchStep()
    const footer = screen.getByTestId('wizard-footer')
    expect(within(footer).getByRole('button', { name: 'Back' }).className).toContain('MuiButton-contained')
    expect(within(footer).getByRole('button', { name: 'Next' }).className).toContain('MuiButton-contained')
  })

  it('shows the problem and stays on the step when the second preview fails, then allows a retry', async () => {
    previewImport.mockResolvedValueOnce(makePreview({ matchCandidates: [makeCandidate(), second({ reasons: ['DATE', 'TEAMS'], matchDate: new Date(2026, 9, 11, 15, 0).toISOString() })] }))
    const user = await toMatchStep()
    previewImport.mockRejectedValueOnce(new Error('down'))

    await user.click(matches().getByRole('radio', { name: /Hilltop Wanderers/ }))
    await user.click(next())

    expect(await screen.findByTestId('import-problem')).toBeInTheDocument()
    expect(screen.getByText('Which match is this?')).toBeInTheDocument()
    await waitFor(() => expect(next()).toBeEnabled())
  })

  describe('Find another match', () => {
    const open = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: 'Find another match' }))
    }
    const toListed = () => previewImport.mockResolvedValue(makePreview({ matchCandidates: [makeCandidate(), second()] }))

    it('opens with the recent matches that have no result, with date, league and section, without typing', async () => {
      listMatches.mockResolvedValue(page([found()]))
      toListed()
      const user = await toMatchStep()
      expect(listMatches).not.toHaveBeenCalled()
      await open(user)

      const group = await screen.findByRole('radiogroup', { name: 'Found by search' })
      expect(within(group).getByText('Northgate Strollers v Lakeside Rovers')).toBeInTheDocument()
      expect(await within(group).findByText(/Saturday League · Seniors/)).toBeInTheDocument()
      expect(listMatches).toHaveBeenCalledWith('club-1', expect.objectContaining({ resultStatus: 'NONE', sort: 'matchDate,desc' }))
    })

    it('never offers a match with a result, or one outside the recent window', async () => {
      const day = 24 * 60 * 60 * 1000
      listMatches.mockResolvedValue(
        page([
          found({ id: 'm-a', awayTeamName: 'Has Draft', resultStatus: 'DRAFT' }),
          found({ id: 'm-b', awayTeamName: 'Far Future', matchDate: new Date(Date.now() + 30 * day).toISOString() }),
          found({ id: 'm-c', awayTeamName: 'Long Ago', matchDate: new Date(Date.now() - 200 * day).toISOString() }),
          found({ id: 'm-d', awayTeamName: 'Just Right' }),
        ]),
      )
      toListed()
      const user = await toMatchStep()
      await open(user)
      await screen.findByRole('radio', { name: /Just Right/ })
      expect(screen.queryByRole('radio', { name: /Has Draft|Far Future|Long Ago/ })).not.toBeInTheDocument()
    })

    it('narrows by team name', async () => {
      listMatches.mockResolvedValue(page([found()]))
      toListed()
      const user = await toMatchStep()
      await open(user)
      await user.type(screen.getByLabelText('Team name (optional)'), 'Lakeside')
      await waitFor(() => expect(listMatches).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ search: 'Lakeside' })))
    })

    it('narrows by section', async () => {
      listMatches.mockResolvedValue(page([found()]))
      toListed()
      const user = await toMatchStep()
      await open(user)
      await user.click(await screen.findByLabelText('Section'))
      await user.click(await screen.findByText('Juniors'))
      await waitFor(() => expect(listMatches).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ sectionId: 'sec-2' })))
    })

    it('choosing a found match previews again with its id and selects it', async () => {
      listMatches.mockResolvedValue(page([found()]))
      toListed()
      const user = await toMatchStep()
      await open(user)
      await screen.findByRole('radio', { name: /Lakeside Rovers/ })
      previewImport.mockResolvedValue(makePreview({ matchCandidates: [makeCandidate({ matchId: 'match-9', awayName: 'Lakeside Rovers', reasons: [] })] }))

      await user.click(screen.getByRole('radio', { name: /Lakeside Rovers/ }))

      await waitFor(() => expect(previewImport).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ matchId: 'match-9' }), null))
      await waitFor(() => expect(matches().getByRole('radio', { name: /Lakeside Rovers/ })).toHaveAttribute('aria-checked', 'true'))
    })

    it('says so when there are none', async () => {
      toListed()
      const user = await toMatchStep()
      await open(user)
      expect(await screen.findByText('No recent matches without a result. Try another section or add the match.')).toBeInTheDocument()
    })

    it('is open from the start when no candidate was proposed', async () => {
      listMatches.mockResolvedValue(page([found()]))
      previewImport.mockResolvedValue(makePreview({ matchCandidates: [] }))
      await toMatchStep()
      expect(await screen.findByRole('radio', { name: /Lakeside Rovers/ })).toBeInTheDocument()
    })
  })

  it('Back returns to the Source step with what was given', async () => {
    const user = await toMatchStep()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('Where is the result coming from?')).toBeInTheDocument()
    expect(screen.getByLabelText('Pasted result content')).toHaveValue('{}')
  })

  // docs/specs/109-delete-empty-match.md
  describe('Delete an empty match (109)', () => {
    const twoWithOneDeletable = () =>
      makePreview({ matchCandidates: [makeCandidate({ deletable: false }), second({ deletable: true })] })

    it('offers Delete only on a deletable candidate, named for its match and outside the radio', async () => {
      previewImport.mockResolvedValue(twoWithOneDeletable())
      await toMatchStep()

      expect(screen.getAllByRole('button', { name: /^Delete match/ })).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Delete match Northgate Strollers v Hilltop Wanderers' })).toBeInTheDocument()
      expect(matches().getByRole('radio', { name: /Hilltop Wanderers/ })).not.toHaveAccessibleName(/Delete/)
    })

    it('pressing Delete opens the confirmation and does not change the selection', async () => {
      previewImport.mockResolvedValue(twoWithOneDeletable())
      const user = await toMatchStep()
      await user.click(matches().getByRole('radio', { name: /Riverside Occasionals/ }))

      await user.click(screen.getByRole('button', { name: 'Delete match Northgate Strollers v Hilltop Wanderers' }))
      const dialog = await screen.findByRole('dialog', { name: 'Delete this match?' })
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(matches().getByRole('radio', { name: /Riverside Occasionals/ })).toHaveAttribute('aria-checked', 'true')
      expect(matches().getByRole('radio', { name: /Hilltop Wanderers/ })).toHaveAttribute('aria-checked', 'false')
      expect(deleteMatch).not.toHaveBeenCalled()
    })

    it('on success the match leaves the list and the other selection stays', async () => {
      previewImport.mockResolvedValue(twoWithOneDeletable())
      deleteMatch.mockResolvedValueOnce(undefined)
      const user = await toMatchStep()
      await user.click(matches().getByRole('radio', { name: /Riverside Occasionals/ }))

      await user.click(screen.getByRole('button', { name: 'Delete match Northgate Strollers v Hilltop Wanderers' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(deleteMatch).toHaveBeenCalledWith('club-1', 'match-2'))
      await waitFor(() => expect(matches().queryByRole('radio', { name: /Hilltop Wanderers/ })).not.toBeInTheDocument())
      expect(matches().getByRole('radio', { name: /Riverside Occasionals/ })).toHaveAttribute('aria-checked', 'true')
      expect(next()).toBeEnabled()
    })

    it('deleting the selected match clears the selection and disables Next', async () => {
      previewImport.mockResolvedValue(twoWithOneDeletable())
      deleteMatch.mockResolvedValueOnce(undefined)
      const user = await toMatchStep()
      await user.click(matches().getByRole('radio', { name: /Hilltop Wanderers/ }))
      expect(matches().getByRole('radio', { name: /Hilltop Wanderers/ })).toHaveAttribute('aria-checked', 'true')

      await user.click(screen.getByRole('button', { name: 'Delete match Northgate Strollers v Hilltop Wanderers' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(matches().queryByRole('radio', { name: /Hilltop Wanderers/ })).not.toBeInTheDocument())
      expect(matches().getByRole('radio', { name: /Riverside Occasionals/ })).toHaveAttribute('aria-checked', 'false')
      expect(next()).toBeDisabled()
    })

    it('shows a refusal message in the dialog and keeps the match', async () => {
      previewImport.mockResolvedValue(twoWithOneDeletable())
      deleteMatch.mockRejectedValueOnce(
        Object.assign(new Error('conflict'), { isAxiosError: true, response: { status: 409, data: { detail: 'This match has a poll. Deactivate it instead.' } } }),
      )
      const user = await toMatchStep()

      await user.click(screen.getByRole('button', { name: 'Delete match Northgate Strollers v Hilltop Wanderers' }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('This match has a poll. Deactivate it instead.')
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(matches().getByRole('radio', { name: /Hilltop Wanderers/ })).toBeInTheDocument()
    })

    describe('on a Find another match result', () => {
      const openSearch = async (user: Awaited<ReturnType<typeof toMatchStep>>) => {
        await user.click(screen.getByRole('button', { name: 'Find another match' }))
        return screen.findByRole('radiogroup', { name: 'Found by search' })
      }
      const deleteName = 'Delete match Northgate Strollers v Lakeside Rovers'

      it('offers Delete only when the found match is deletable', async () => {
        previewImport.mockResolvedValue(twoWithOneDeletable())
        listMatches.mockResolvedValue(page([found({ id: 'match-8', awayTeamName: 'Plain Rovers' }), found({ deletable: true })]))
        const user = await toMatchStep()
        await openSearch(user)

        expect(await screen.findByRole('button', { name: deleteName })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Delete match Northgate Strollers v Plain Rovers' })).not.toBeInTheDocument()
      })

      it('confirms, deletes and removes the row from the search results', async () => {
        previewImport.mockResolvedValue(twoWithOneDeletable())
        listMatches.mockResolvedValueOnce(page([found({ deletable: true })])).mockResolvedValue(page([]))
        deleteMatch.mockResolvedValueOnce(undefined)
        const user = await toMatchStep()
        await user.click(matches().getByRole('radio', { name: /Riverside Occasionals/ }))
        const group = await openSearch(user)

        await user.click(await within(group).findByRole('button', { name: deleteName }))
        const dialog = await screen.findByRole('dialog', { name: 'Delete this match?' })
        expect(deleteMatch).not.toHaveBeenCalled()
        await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

        await waitFor(() => expect(deleteMatch).toHaveBeenCalledWith('club-1', 'match-9'))
        await waitFor(() => expect(screen.queryByRole('radiogroup', { name: 'Found by search' })).not.toBeInTheDocument())
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(matches().getByRole('radio', { name: /Riverside Occasionals/ })).toHaveAttribute('aria-checked', 'true')
      })

      it('clears the selection when the deleted match was the chosen one', async () => {
        previewImport.mockResolvedValue(makePreview({ matchCandidates: [makeCandidate({ matchId: 'match-9', homeName: 'Northgate Strollers', awayName: 'Lakeside Rovers', deletable: true }), second()] }))
        deleteMatch.mockResolvedValueOnce(undefined)
        const user = await toMatchStep()
        await user.click(matches().getByRole('radio', { name: /Lakeside Rovers/ }))

        await user.click(screen.getByRole('button', { name: deleteName }))
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))

        await waitFor(() => expect(matches().queryByRole('radio', { name: /Lakeside Rovers/ })).not.toBeInTheDocument())
        expect(next()).toBeDisabled()
      })

      it('shows a refusal message in the dialog and keeps the row', async () => {
        previewImport.mockResolvedValue(twoWithOneDeletable())
        listMatches.mockResolvedValue(page([found({ deletable: true })]))
        deleteMatch.mockRejectedValueOnce(
          Object.assign(new Error('conflict'), { isAxiosError: true, response: { status: 409, data: { detail: 'This match has a poll. Deactivate it instead.' } } }),
        )
        const user = await toMatchStep()
        const group = await openSearch(user)

        await user.click(await within(group).findByRole('button', { name: deleteName }))
        const dialog = await screen.findByRole('dialog')
        await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

        expect(await within(dialog).findByRole('alert')).toHaveTextContent('This match has a poll. Deactivate it instead.')
        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(screen.getByRole('radiogroup', { name: 'Found by search' })).toBeInTheDocument()
      })
    })
  })
})
