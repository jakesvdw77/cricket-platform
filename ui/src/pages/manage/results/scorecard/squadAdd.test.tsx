import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultPlayer, Scorecard } from '../../../../api/matchResultApi'
import { addPlayerToSquad, squadKey, useAutoAddToSquad } from './squadAdd'
import { usePlayerActions } from './usePlayerActions'

// docs/specs/118-result-review-fixes.md, UI requirement 1: a player linked or added on an ours side joins the team's squad for the
// match's season - best effort, never blocking, never on Swap.

const addToSquad = vi.fn()
const listSquad = vi.fn()

vi.mock('../../../../api/teamSquadApi', () => ({
  addToSquad: (...args: unknown[]) => addToSquad(...args),
  listSquad: (...args: unknown[]) => listSquad(...args),
}))
vi.mock('../../../../hooks/useTeamSectionId', () => ({ useTeamSectionLookup: () => ({ sectionId: null, pending: false }) }))
// The picker has its own tests; here it only stands in for "choose a registered player".
vi.mock('../../../../components/PlayerSlotPicker', () => ({
  PlayerSlotPicker: ({ open, onPickPlayer }: { open: boolean; onPickPlayer: (p: { playerProfileId: string; firstName: string; lastName: string }) => void }) =>
    open ? <button onClick={() => onPickPlayer({ playerProfileId: 'p-zoe', firstName: 'Zoe', lastName: 'Zane' })}>Pick Zoe Zane</button> : null,
}))

const status = (code: number) => new AxiosError('nope', String(code), undefined, undefined, { status: code } as never)
const flush = () => act(async () => { await Promise.resolve() })

beforeEach(() => {
  vi.clearAllMocks()
  listSquad.mockResolvedValue([])
  addToSquad.mockResolvedValue({})
})

describe('addPlayerToSquad', () => {
  it('calls the squad endpoint with the team, season and player', async () => {
    await addPlayerToSquad('club-1', 'team-1', 'season-1', 'p-1')
    expect(addToSquad).toHaveBeenCalledWith('club-1', 'team-1', 'season-1', 'p-1')
  })

  it.each([409, 400])('treats a %i (already in the squad / not an active member) as done', async (code) => {
    addToSquad.mockRejectedValue(status(code))
    await expect(addPlayerToSquad('club-1', 'team-1', 'season-1', 'p-1')).resolves.toBeUndefined()
  })

  it('throws any other failure, such as a section-scope refusal', async () => {
    addToSquad.mockRejectedValue(status(403))
    await expect(addPlayerToSquad('club-1', 'team-1', 'season-1', 'p-1')).rejects.toBeDefined()
  })
})

describe('useAutoAddToSquad', () => {
  function setup(seasonId: string | null = 'season-1') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useAutoAddToSquad('club-1', seasonId), { wrapper })
    return { autoAdd: result.current, invalidate }
  }

  it('adds a player who is not in the squad and refreshes the squad query', async () => {
    const { autoAdd, invalidate } = setup()
    await autoAdd('team-1', 'p-1')
    expect(addToSquad).toHaveBeenCalledWith('club-1', 'team-1', 'season-1', 'p-1')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: squadKey('club-1', 'team-1', 'season-1') })
  })

  it('skips a player already in the squad', async () => {
    listSquad.mockResolvedValue([{ playerProfileId: 'p-1' }])
    await setup().autoAdd('team-1', 'p-1')
    expect(addToSquad).not.toHaveBeenCalled()
  })

  it('skips with no season, no team (the opposition) or no player (a guest)', async () => {
    await setup(null).autoAdd('team-1', 'p-1')
    await setup().autoAdd(null, 'p-1')
    await setup().autoAdd('team-1', null)
    expect(listSquad).not.toHaveBeenCalled()
    expect(addToSquad).not.toHaveBeenCalled()
  })

  it.each([409, 400, 403, 500])('never throws when the add fails with %i', async (code) => {
    addToSquad.mockRejectedValue(status(code))
    await expect(setup().autoAdd('team-1', 'p-1')).resolves.toBeUndefined()
  })

  it('never throws when the squad cannot even be read', async () => {
    listSquad.mockRejectedValue(status(500))
    await expect(setup().autoAdd('team-1', 'p-1')).resolves.toBeUndefined()
    expect(addToSquad).not.toHaveBeenCalled()
  })
})

describe('usePlayerActions auto-add', () => {
  const guest = { id: 'id-g', side: 'HOME', playerProfileId: null, displayName: 'Gus Guest', substitute: false } as unknown as ResultPlayer
  const scorecard: Scorecard = { players: [guest], batting: [], bowling: [], fielding: [], awards: [] }

  function Harness({ autoAddToSquad = true, teamId = 'team-1', onScorecard = () => {}, onAdd = () => {} }: { autoAddToSquad?: boolean; teamId?: string | null; onScorecard?: (s: Scorecard) => void; onAdd?: () => void }) {
    const actions = usePlayerActions({
      clubId: 'club-1', seasonId: 'season-1', ours: { side: 'HOME', teamId }, scorecard, onScorecard, ids: ['id-g'], positionLabel: 'Batting position', view: [],
      onReorder: () => {}, removeLabel: 'Remove', removeDescription: () => '', onRemove: () => {}, onAdd, autoAddToSquad,
    })
    return (
      <>
        <button onClick={actions.openAdd}>open add</button>
        <button onClick={() => actions.openLink('id-g')}>open link</button>
        <button onClick={() => actions.openSwap('id-g')}>open swap</button>
        {actions.host}
      </>
    )
  }
  function renderHarness(props: Parameters<typeof Harness>[0] = {}) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={queryClient}><Harness {...props} /></QueryClientProvider>)
  }

  it.each(['open link', 'open add'])('adds the picked player to the squad from %s', async (opener) => {
    const user = userEvent.setup()
    const onScorecard = vi.fn()
    renderHarness({ onScorecard })
    await user.click(screen.getByRole('button', { name: opener }))
    await user.click(await screen.findByRole('button', { name: 'Pick Zoe Zane' }))
    await waitFor(() => expect(addToSquad).toHaveBeenCalledWith('club-1', 'team-1', 'season-1', 'p-zoe'))
  })

  it('does not add on Swap', async () => {
    const user = userEvent.setup()
    const onScorecard = vi.fn()
    renderHarness({ onScorecard })
    await user.click(screen.getByRole('button', { name: 'open swap' }))
    await user.click(await screen.findByRole('button', { name: 'Pick Zoe Zane' }))
    await flush()
    expect(onScorecard).toHaveBeenCalled()
    expect(listSquad).not.toHaveBeenCalled()
    expect(addToSquad).not.toHaveBeenCalled()
  })

  it('does not add when the step does not ask for it (the Batting and Bowling steps)', async () => {
    const user = userEvent.setup()
    renderHarness({ autoAddToSquad: false })
    await user.click(screen.getByRole('button', { name: 'open link' }))
    await user.click(await screen.findByRole('button', { name: 'Pick Zoe Zane' }))
    await flush()
    expect(addToSquad).not.toHaveBeenCalled()
  })

  it('still saves the pick when the squad add is refused', async () => {
    addToSquad.mockRejectedValue(status(409))
    const user = userEvent.setup()
    const onScorecard = vi.fn()
    renderHarness({ onScorecard })
    await user.click(screen.getByRole('button', { name: 'open link' }))
    await user.click(await screen.findByRole('button', { name: 'Pick Zoe Zane' }))
    await waitFor(() => expect(addToSquad).toHaveBeenCalled())
    expect(onScorecard).toHaveBeenCalledOnce()
  })

  it('does not add for the opposition (no team)', async () => {
    const user = userEvent.setup()
    renderHarness({ teamId: null })
    await user.click(screen.getByRole('button', { name: 'open add' }))
    await user.click(await screen.findByRole('button', { name: 'Pick Zoe Zane' }))
    await flush()
    expect(addToSquad).not.toHaveBeenCalled()
  })
})
