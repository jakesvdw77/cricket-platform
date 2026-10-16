import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchCandidate } from '../../../../api/resultImportApi'
import { jsonAdaptor, makeCandidate, makeCatalogue, makePreview, renderImportPage } from './importTestUtils'

const getImportCatalogue = vi.fn()
const previewImport = vi.fn()
const createMatch = vi.fn()

vi.mock('../../../../api/resultImportApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../api/resultImportApi')>()
  return {
    ...actual,
    getImportCatalogue: (clubId: string) => getImportCatalogue(clubId),
    previewImport: (clubId: string, request: unknown, file?: File | null) => previewImport(clubId, request, file),
  }
})
// The Add match dialog's own data.
vi.mock('../../../../api/matchApi', () => ({ createMatch: (clubId: string, payload: unknown) => createMatch(clubId, payload) }))
vi.mock('../../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([]) }))
vi.mock('../../../../api/seasonApi', () => ({ listSeasons: () => Promise.resolve([]) }))
vi.mock('../../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([]) }))
vi.mock('../../../../api/leagueAffiliationApi', () => ({ listLeagueAffiliations: () => Promise.resolve([]) }))
vi.mock('../../../../api/leagueTeamApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../../api/leagueTeamApi')>()), listLeagueTeams: () => Promise.resolve([]) }))
vi.mock('../../../../api/meApi', () => ({ activateSession: () => Promise.resolve({ personId: null, personStatus: null, platformAdmin: false, clubAdminClubIds: [] }) }))

const second = (overrides: Partial<MatchCandidate> = {}) =>
  makeCandidate({ matchId: 'match-2', homeName: 'Northgate Strollers', awayName: 'Hilltop Wanderers', matchDate: new Date(2026, 9, 18, 13, 0).toISOString(), reasons: ['TEAMS'], ...overrides })

beforeEach(() => {
  vi.clearAllMocks()
  getImportCatalogue.mockResolvedValue(makeCatalogue([jsonAdaptor]))
  previewImport.mockResolvedValue(makePreview())
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

  it('Back returns to the Source step with what was given', async () => {
    const user = await toMatchStep()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('Where is the result coming from?')).toBeInTheDocument()
    expect(screen.getByLabelText('Pasted result content')).toHaveValue('{}')
  })
})
