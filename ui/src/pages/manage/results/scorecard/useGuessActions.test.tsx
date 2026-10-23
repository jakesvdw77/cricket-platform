import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultPlayer, Scorecard } from '../../../../api/matchResultApi'
import type { ImportNote } from '../../../../api/resultImportApi'
import { ImportReviewContext } from '../import/importReviewContext'
import { useGuessActions } from './useGuessActions'

const addToSquad = vi.fn()
vi.mock('../../../../api/teamSquadApi', () => ({ addToSquad: (...args: unknown[]) => addToSquad(...args), listSquad: () => Promise.resolve([]) }))
vi.mock('../../../../hooks/useTeamSectionId', () => ({ useTeamSectionLookup: () => ({ sectionId: null, pending: false }) }))
vi.mock('../../../../components/PlayerSlotPicker', () => ({
  PlayerSlotPicker: ({ open, onPickPlayer }: { open: boolean; onPickPlayer: (p: { playerProfileId: string; firstName: string; lastName: string }) => void }) =>
    open ? <button onClick={() => onPickPlayer({ playerProfileId: 'p-zoe', firstName: 'Zoe', lastName: 'Zane' })}>Pick Zoe Zane</button> : null,
}))

beforeEach(() => addToSquad.mockReset())

const ours = (key: string, extra: Partial<ResultPlayer> = {}): ResultPlayer => ({
  id: `id-${key}`,
  side: 'HOME',
  playerProfileId: `p-${key}`,
  displayName: key,
  plannedBattingOrder: null,
  replacedPlayerProfileId: null,
  substitute: false,
  firstName: key,
  lastName: 'Smith',
  guest: false,
  ...extra,
})

const scorecardOf = (players: ResultPlayer[]): Scorecard => ({ players, batting: [], bowling: [], fielding: [], awards: [] })

const notes: ImportNote[] = [
  { code: 'NAME_INITIALS', severity: 'INFO', section: 'ours', message: 'Matched by initials.', fileText: 'Ann', candidateName: 'Ann Smith', level: 'NORMALISED' },
  { code: 'NAME_UNRESOLVED', severity: 'WARNING', section: 'ours', message: 'Not placed.', fileText: 'Dino V', level: 'UNRESOLVED', suggestions: [{ playerProfileId: 'p-hank', displayName: 'Hank Brow', score: 0.8 }] },
]

function setup(players: ResultPlayer[], provider: string | null = 'ACMESCORE') {
  const onScorecard = vi.fn()
  const scorecard = scorecardOf(players)
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>
      <ImportReviewContext.Provider value={{ provider, notes }}>{children}</ImportReviewContext.Provider>
    </QueryClientProvider>
  const { result } = renderHook(() => useGuessActions({ clubId: 'club-1', seasonId: 's-1', oursSides: [], prefill: null, scorecard, onScorecard }), { wrapper })
  return { result, onScorecard }
}

const lastWritten = (onScorecard: ReturnType<typeof vi.fn>) => onScorecard.mock.calls.at(-1)?.[0] as Scorecard

describe('useGuessActions', () => {
  const ann = ours('ann', { importMatch: 'NORMALISED' })
  const dan = ours('dan', { importMatch: 'AI_SUGGESTED' })
  const bob = ours('bob')
  const guest = ours('guest', { playerProfileId: null, displayName: 'Dino V', firstName: null, lastName: null, guest: true })

  it('hands a chip nothing for a result that was not imported or a row with nothing to check', () => {
    expect(setup([ann], null).result.current.guessOf(ann)).toBeUndefined()
    expect(setup([bob]).result.current.guessOf(bob)).toBeUndefined()
  })

  it('confirming one row clears only its own guess', () => {
    const { result, onScorecard } = setup([ann, dan, bob, guest])
    const info = result.current.guessOf(ann)
    expect(info).toMatchObject({ level: 'NORMALISED', importedName: 'ann', matchedName: 'Ann Smith', reason: 'by initials' })

    info?.onConfirm?.()

    const players = lastWritten(onScorecard).players
    expect(players.find((p) => p.id === 'id-ann')?.importMatch).toBeNull()
    expect(players.find((p) => p.id === 'id-dan')?.importMatch).toBe('AI_SUGGESTED')
  })

  it('offers a confirm on a guess of either level and none on an unresolved guest', () => {
    const { result } = setup([ann, dan, guest])
    expect(result.current.guessOf(ann)?.onConfirm).toBeDefined()
    expect(result.current.guessOf(guest)).toMatchObject({ level: 'UNRESOLVED', matchedName: null })
    expect(result.current.guessOf(guest)?.onConfirm).toBeUndefined()
  })

  it('use closest links the row to the top suggestion, keeps the file spelling and clears the guess', () => {
    const { result, onScorecard } = setup([ann, guest])
    const info = result.current.guessOf(guest)
    expect(info?.closest?.displayName).toBe('Hank Brow')

    info?.onUseClosest?.()

    const swapped = lastWritten(onScorecard).players.find((p) => p.id === 'id-guest')
    expect(swapped).toMatchObject({ playerProfileId: 'p-hank', firstName: 'Hank', lastName: 'Brow', displayName: 'Dino V', guest: false, importMatch: null })
    expect(lastWritten(onScorecard).players.find((p) => p.id === 'id-ann')?.importMatch).toBe('NORMALISED')
  })

  it('hides use closest when that player is already on the side', () => {
    const hank = ours('hank', { playerProfileId: 'p-hank' })
    const { result } = setup([hank, guest])
    const info = result.current.guessOf(guest)
    expect(info?.closest?.displayName).toBe('Hank Brow')
    expect(info?.onUseClosest).toBeUndefined()
  })
})

// docs/specs/118: choosing a player in the import's Change picker on the Teams step also joins the team's squad.
describe('useGuessActions auto-add to the squad', () => {
  const guest = ours('guest', { playerProfileId: null, displayName: 'Dino V', firstName: null, lastName: null, guest: true })

  function Harness({ autoAddToSquad }: { autoAddToSquad?: boolean }) {
    const { guessOf, host } = useGuessActions({
      clubId: 'club-1', seasonId: 's-1', oursSides: [{ side: 'HOME', teamId: 'team-1', teamName: '1st XI' }] as never, prefill: null,
      scorecard: scorecardOf([guest]), onScorecard: () => {}, autoAddToSquad,
    })
    return <><button onClick={() => guessOf(guest)?.onChange()}>change</button>{host}</>
  }
  const renderHarness = (autoAddToSquad?: boolean) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ImportReviewContext.Provider value={{ provider: 'ACMESCORE', notes }}><Harness autoAddToSquad={autoAddToSquad} /></ImportReviewContext.Provider>
      </QueryClientProvider>,
    )

  it('adds the chosen player to the side\'s squad for the season on the Teams step', async () => {
    addToSquad.mockResolvedValue({})
    renderHarness(true)
    await userEvent.click(screen.getByRole('button', { name: 'change' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pick Zoe Zane' }))
    await waitFor(() => expect(addToSquad).toHaveBeenCalledWith('club-1', 'team-1', 's-1', 'p-zoe'))
  })

  it('does not add on the other steps', async () => {
    renderHarness(false)
    await userEvent.click(screen.getByRole('button', { name: 'change' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pick Zoe Zane' }))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(addToSquad).not.toHaveBeenCalled()
  })
})
