import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Match } from '../../../api/matchApi'
import type { MatchSide } from '../../../api/matchSideApi'
import { useMatchSidePanel } from './useMatchSidePanel'

const listMatchSides = vi.fn()
const createMatchSide = vi.fn()
const announceMatchSide = vi.fn()
const unannounceMatchSide = vi.fn()
const removeMatchSidePlayer = vi.fn()
const getSelectionPool = vi.fn()
const applySelection = vi.fn()
const getMatchSquad = vi.fn()

vi.mock('../../../api/matchApi', () => ({ listPreviousMatches: () => Promise.resolve([]) }))
vi.mock('../../../api/playerApi', () => ({ createPlayer: vi.fn() }))
vi.mock('../../../api/teamSquadApi', () => ({ addToSquad: vi.fn() }))
vi.mock('../../../api/matchAvailabilityApi', () => ({ setPlayerStatus: vi.fn() }))
vi.mock('../../../api/sectionAvailabilityApi', () => ({ setRoundPlayerStatus: vi.fn() }))
vi.mock('../../../api/matchSquadApi', () => ({
  getMatchSquad: (...args: unknown[]) => getMatchSquad(...args),
}))
vi.mock('../../../api/matchSideApi', () => ({
  listMatchSides: (...args: unknown[]) => listMatchSides(...args),
  createMatchSide: (...args: unknown[]) => createMatchSide(...args),
  announceMatchSide: (...args: unknown[]) => announceMatchSide(...args),
  unannounceMatchSide: (...args: unknown[]) => unannounceMatchSide(...args),
  removeMatchSidePlayer: (...args: unknown[]) => removeMatchSidePlayer(...args),
  updateMatchSide: vi.fn(),
  updateMatchSidePlayerRole: vi.fn(),
  reorderMatchSidePlayers: vi.fn(),
}))
vi.mock('../../../api/matchSelectionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/matchSelectionApi')>()
  return {
    ...actual,
    getSelectionPool: (...args: unknown[]) => getSelectionPool(...args),
    applySelection: (...args: unknown[]) => applySelection(...args),
  }
})

const match = { id: 'match-1', seasonId: 'season-1', leagueId: null, matchDate: '2026-06-01T14:30:00Z' } as Match

function makeSide(overrides: Partial<MatchSide> = {}): MatchSide {
  return {
    id: 'side-1',
    matchId: 'match-1',
    teamId: 'team-1',
    captainPlayerId: null,
    wicketKeeperPlayerId: null,
    twelfthManPlayerId: null,
    players: [
      { playerProfileId: 'p1', battingOrder: 1, role: 'BATSMAN', firstName: 'Ann', lastName: 'Ash' },
      { playerProfileId: 'p2', battingOrder: 2, role: 'BOWLER', firstName: 'Bob', lastName: 'Birch' },
    ],
    announced: false,
    limits: { battingPlaces: 2, twelfthManAllowed: false, maxSelected: 2 },
    ...overrides,
  }
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const spy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const view = renderHook(
    () => useMatchSidePanel({ clubId: 'club-1', match, teamId: 'team-1', teamName: '1st XI', teamsById: new Map() }),
    { wrapper },
  )
  return { ...view, spy }
}

const overviewInvalidated = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.some(([filters]) => JSON.stringify(filters) === JSON.stringify({ queryKey: ['managed-club', 'club-1', 'team-selection'] }))

beforeEach(() => {
  vi.clearAllMocks()
  listMatchSides.mockResolvedValue([makeSide()])
  getSelectionPool.mockResolvedValue({ coveringPoll: { kind: 'NONE' }, entries: [] })
  getMatchSquad.mockResolvedValue({ windowId: null })
})

describe('useMatchSidePanel', () => {
  it('creates the side on first use when the match has none', async () => {
    listMatchSides.mockResolvedValueOnce([]).mockResolvedValue([makeSide()])
    createMatchSide.mockResolvedValue(makeSide())
    const { result } = setup()
    await waitFor(() => expect(createMatchSide).toHaveBeenCalledWith('club-1', 'match-1', 'team-1'))
    await waitFor(() => expect(result.current.settingUp).toBe(false))
  })

  it('pick: Done sends the existing players bare and puts a new one at the end of the batting order', async () => {
    listMatchSides.mockResolvedValue([makeSide({ limits: { battingPlaces: 11, twelfthManAllowed: true, maxSelected: 12 } })])
    applySelection.mockResolvedValue(makeSide())
    const { result, spy } = setup()
    await waitFor(() => expect(result.current.settingUp).toBe(false))

    let outcome: unknown
    await act(async () => {
      outcome = await result.current.dialog.apply(['p1', 'p2', 'p3'])
    })

    expect(applySelection).toHaveBeenCalledWith('club-1', 'match-1', 'side-1', {
      players: [{ playerProfileId: 'p1' }, { playerProfileId: 'p2' }, { playerProfileId: 'p3', battingOrder: 3 }],
    })
    expect(outcome).toEqual({ ok: true })
    expect(overviewInvalidated(spy)).toBe(true)
  })

  it('refusal: a 409 returns the rule message and rejections, writes nothing back and does not refresh the overview', async () => {
    const rejection = { playerProfileId: 'p3', playerName: 'Cal Cox', reason: 'TAKEN_FOR_SLOT', message: 'Cal is already in 2nd XI.', taken: null }
    applySelection.mockRejectedValue(
      Object.assign(new Error('Conflict'), {
        isAxiosError: true,
        response: { status: 409, data: { detail: 'Some players cannot be selected', rejections: [rejection] } },
      }),
    )
    const { result, spy } = setup()
    await waitFor(() => expect(result.current.settingUp).toBe(false))
    spy.mockClear()

    let outcome: unknown
    await act(async () => {
      outcome = await result.current.dialog.apply(['p1', 'p2', 'p3'])
    })

    expect(outcome).toEqual({ ok: false, message: 'Some players cannot be selected', rejections: [rejection] })
    expect(overviewInvalidated(spy)).toBe(false)
  })

  it('refusal: any other failure gives a plain message', async () => {
    applySelection.mockRejectedValue(new Error('boom'))
    const { result } = setup()
    await waitFor(() => expect(result.current.settingUp).toBe(false))

    let outcome: { ok: boolean; message?: string } | undefined
    await act(async () => {
      outcome = (await result.current.dialog.apply(['p1'])) as typeof outcome
    })

    expect(outcome?.ok).toBe(false)
    expect(outcome?.message).toBeTruthy()
  })

  it('announce: asks first, announces the side and refreshes the overview', async () => {
    announceMatchSide.mockResolvedValue(makeSide({ announced: true }))
    const { result, spy } = setup()
    await waitFor(() => expect(result.current.settingUp).toBe(false))
    expect(result.current.blockedReason).toBeNull()

    act(() => result.current.setConfirmAnnounce(true))
    expect(announceMatchSide).not.toHaveBeenCalled()
    act(() => result.current.announce())

    await waitFor(() => expect(announceMatchSide).toHaveBeenCalledWith('club-1', 'match-1', 'side-1'))
    await waitFor(() => expect(result.current.confirmAnnounce).toBe(false))
    await waitFor(() => expect(overviewInvalidated(spy)).toBe(true))
  })

  it('announce is blocked with the server\'s own wording when a player has no batting position', async () => {
    listMatchSides.mockResolvedValue([
      makeSide({
        players: [
          { playerProfileId: 'p1', battingOrder: 1, role: 'BATSMAN', firstName: 'Ann', lastName: 'Ash' },
          { playerProfileId: 'p2', battingOrder: null, role: 'BOWLER', firstName: 'Bob', lastName: 'Birch' },
        ],
      }),
    ])
    const { result } = setup()
    await waitFor(() => expect(result.current.blockedReason).toBe('Cannot announce 1st XI: 1 player has no batting position (Bob Birch).'))
    expect(result.current.waitingCount).toBe(1)
  })

  it('un-announce: calls the endpoint straight away and refreshes the overview', async () => {
    listMatchSides.mockResolvedValue([makeSide({ announced: true })])
    unannounceMatchSide.mockResolvedValue(makeSide())
    const { result, spy } = setup()
    await waitFor(() => expect(result.current.settingUp).toBe(false))

    act(() => result.current.unannounce())

    await waitFor(() => expect(unannounceMatchSide).toHaveBeenCalledWith('club-1', 'match-1', 'side-1'))
    await waitFor(() => expect(overviewInvalidated(spy)).toBe(true))
  })

  it('release: removes the player from the other team without un-announcing it and refreshes the overview', async () => {
    removeMatchSidePlayer.mockResolvedValue(makeSide())
    const { result, spy } = setup()
    await waitFor(() => expect(result.current.settingUp).toBe(false))
    spy.mockClear()

    await act(async () => {
      await result.current.dialog.release({
        playerProfileId: 'p3',
        taken: { matchId: 'match-2', sideId: 'side-9', teamName: '2nd XI' },
      } as never)
    })

    expect(removeMatchSidePlayer).toHaveBeenCalledWith('club-1', 'match-2', 'side-9', 'p3', true)
    expect(overviewInvalidated(spy)).toBe(true)
  })
})
