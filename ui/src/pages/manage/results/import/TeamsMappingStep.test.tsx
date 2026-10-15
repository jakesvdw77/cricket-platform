import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportPreview } from '../../../../api/resultImportApi'
import { jsonAdaptor, makeCandidate, makeCatalogue, makePreview, makeResolved, nameNote, renderImportPage } from './importTestUtils'

const getImportCatalogue = vi.fn()
const previewImport = vi.fn()
const resolveImport = vi.fn()

vi.mock('../../../../api/resultImportApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../api/resultImportApi')>()
  return {
    ...actual,
    getImportCatalogue: (clubId: string) => getImportCatalogue(clubId),
    previewImport: (clubId: string, request: unknown, file?: File | null) => previewImport(clubId, request, file),
    resolveImport: (clubId: string, request: unknown) => resolveImport(clubId, request),
  }
})

const draft = { matchId: 'match-1', status: 'DRAFT' as const, source: 'MANUAL', hasScorecard: false, updatedAt: '2026-10-12T10:00:00Z' }

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  getImportCatalogue.mockResolvedValue(makeCatalogue([jsonAdaptor]))
  previewImport.mockResolvedValue(makePreview())
  resolveImport.mockResolvedValue(makeResolved())
})

async function toTeamsStep(preview: ImportPreview = makePreview()) {
  previewImport.mockResolvedValue(preview)
  const user = userEvent.setup()
  renderImportPage()
  await user.click(await screen.findByRole('tab', { name: 'Paste' }))
  await user.click(screen.getByLabelText('Pasted result content'))
  await user.paste('{}')
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByText('Which match is this?')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Which side is which?')
  return user
}

const create = () => screen.getByRole('button', { name: 'Create draft and review' })
const sideOf = (fileTeam: string) => {
  const card = screen.getByText(fileTeam, { selector: 'p' }).closest('div[class*="MuiBox"]')?.parentElement as HTMLElement
  return within(card).getByLabelText('Is this side of the match')
}

describe('Teams mapping step', () => {
  it('shows the server proposal for each file team with how sure it was and why', async () => {
    await toTeamsStep()
    expect(sideOf('Northgate Strollers')).toHaveTextContent('Northgate Strollers (home)')
    expect(sideOf('Riverside Occasionals')).toHaveTextContent('Riverside Occasionals (away)')
    expect(screen.getByText('Exact')).toBeInTheDocument()
    expect(screen.getByText('Normalised')).toBeInTheDocument()
    expect(screen.getByText('Matched ignoring capitals.')).toBeInTheDocument()
  })

  it('cannot create until every file team has a side', async () => {
    const user = await toTeamsStep(
      makePreview({ teamMapping: [{ fileKey: 'a', fileName: 'Northgate Strollers', side: null, exactness: 'UNRESOLVED' }, { fileKey: 'b', fileName: 'Riverside Occasionals', side: null, exactness: 'UNRESOLVED' }] }),
    )
    expect(create()).toBeDisabled()
    expect(screen.getAllByText('Unresolved')).toHaveLength(2)

    await user.click(sideOf('Northgate Strollers'))
    await user.click(await screen.findByRole('option', { name: 'Northgate Strollers (home)' }))
    // Choosing one side puts the other file team on the opposite side.
    expect(sideOf('Riverside Occasionals')).toHaveTextContent('Riverside Occasionals (away)')
    expect(create()).toBeEnabled()
    // Both cards now say the side is the manager's, not the server's.
    expect(screen.getAllByText('Chosen by you')).toHaveLength(2)
  })

  it('Swap sides exchanges the two and sends the swapped mapping', async () => {
    const user = await toTeamsStep()
    await user.click(screen.getByRole('button', { name: 'Swap sides' }))

    expect(sideOf('Northgate Strollers')).toHaveTextContent('Riverside Occasionals (away)')
    expect(sideOf('Riverside Occasionals')).toHaveTextContent('Northgate Strollers (home)')
    expect(screen.getAllByText('Chosen by you')).toHaveLength(2)

    await user.click(create())
    await waitFor(() => expect(resolveImport).toHaveBeenCalled())
    expect(resolveImport.mock.calls[0][1]).toMatchObject({
      matchId: 'match-1',
      teamMapping: [
        { fileKey: 'a', side: 'AWAY' },
        { fileKey: 'b', side: 'HOME' },
      ],
      replaceExistingDraft: false,
    })
  })

  it('needs the replace-draft tick when the match already has a draft, and sends the acknowledgement', async () => {
    const user = await toTeamsStep(makePreview({ matchCandidates: [makeCandidate({ existingResult: draft })] }))

    const tick = screen.getByRole('checkbox', { name: 'Replace the existing draft' })
    expect(screen.getByText(/This match already has a draft, last edited/)).toBeInTheDocument()
    expect(create()).toBeDisabled()

    await user.click(tick)
    expect(create()).toBeEnabled()
    await user.click(create())
    await waitFor(() => expect(resolveImport).toHaveBeenCalled())
    expect(resolveImport.mock.calls[0][1]).toMatchObject({ replaceExistingDraft: true })
  })

  it('shows no replace tick when there is no draft, and says nothing is published', async () => {
    await toTeamsStep()
    expect(screen.queryByRole('checkbox', { name: 'Replace the existing draft' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Nothing is published. The draft is only visible to managers.').length).toBeGreaterThan(0)
  })

  it('has no AI control anywhere', async () => {
    await toTeamsStep()
    expect(screen.queryByText(/\bAI\b/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /AI|suggest/i })).not.toBeInTheDocument()
  })

  it('locks the step while the draft is being created, with a pending label', async () => {
    resolveImport.mockReturnValue(new Promise(() => undefined))
    const user = await toTeamsStep()
    await user.click(create())

    const pending = await screen.findByRole('button', { name: 'Creating the draft…' })
    expect(pending).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Swap sides' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
  })

  it('on success summarises the draft, lists the notes that are not about a name, warnings first, and keeps the name notes for the wizard', async () => {
    resolveImport.mockResolvedValue(
      makeResolved({
        notes: [
          { code: 'FOW_IGNORED', severity: 'INFO', section: 'innings', message: 'Fall of wickets was ignored.' },
          { code: 'SUPER_OVER_DROPPED', severity: 'WARNING', section: 'innings', message: 'Super-over rows were dropped.' },
          nameNote('Hari K'),
        ],
        validation: { canPublish: true, errors: [], warnings: ['One thing to look at.'], issues: [] },
      }),
    )
    const user = await toTeamsStep()
    await user.click(create())

    const created = await screen.findByTestId('import-created')
    expect(created).toHaveTextContent('Draft created. 9 names matched exactly, 2 are guesses to check, 1 is a guest.')
    expect(created).toHaveTextContent('Checks: 0 errors, 1 warning.')
    const items = within(within(created).getByTestId('import-notes')).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['Super-over rows were dropped.', 'Fall of wickets was ignored.'])
    expect(screen.queryByRole('button', { name: 'Create draft and review' })).not.toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('resultImport:notes:club-1:match-1') ?? '[]')).toHaveLength(1)
  })

  it('Review in the result wizard opens the capture wizard flagged as just imported', async () => {
    const user = await toTeamsStep()
    await user.click(create())
    await user.click(await screen.findByRole('button', { name: 'Review in the result wizard' }))
    expect(await screen.findByTestId('where')).toHaveTextContent('/manage/results/match-1/capture?imported=1')
  })

  it('keeps the step and offers a retry when creating fails, and links the other match when the id is used elsewhere', async () => {
    resolveImport.mockRejectedValue(new AxiosError('conflict', '409', undefined, undefined, { status: 409, data: { detail: 'That id is used by another match.', otherMatchId: 'match-9' } } as never))
    const user = await toTeamsStep()
    await user.click(create())

    expect(await screen.findByTestId('import-problem')).toHaveTextContent('That id is used by another match.')
    expect(screen.getByRole('link', { name: 'View the match that has it' })).toHaveAttribute('href', '/manage/fixtures/matches/match-9')
    expect(create()).toBeEnabled()
  })

  it('Back returns to the Match step', async () => {
    const user = await toTeamsStep()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('Which match is this?')).toBeInTheDocument()
  })
})
