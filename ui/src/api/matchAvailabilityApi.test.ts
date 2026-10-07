import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { listClosedPolls, listOpenPolls } from './matchAvailabilityApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

describe('matchAvailabilityApi poll lists (docs/specs/083)', () => {
  beforeEach(() => vi.mocked(api.get).mockReset().mockResolvedValue({ data: [] }))

  it('sends only the scope filters that are set on the open list', async () => {
    await listOpenPolls('club-1')
    expect(api.get).toHaveBeenLastCalledWith('/manage/clubs/club-1/availability-polls/open', { params: {} })

    await listOpenPolls('club-1', { leagueId: 'l-1', sectionId: 's-1', teamId: 't-1' })
    expect(api.get).toHaveBeenLastCalledWith('/manage/clubs/club-1/availability-polls/open', {
      params: { leagueId: 'l-1', sectionId: 's-1', teamId: 't-1' },
    })
  })

  it('sends the same filters on the closed list', async () => {
    await listClosedPolls('club-1', { leagueId: 'l-1', teamId: 't-1' })
    expect(api.get).toHaveBeenLastCalledWith('/manage/clubs/club-1/availability-polls/closed', {
      params: { leagueId: 'l-1', teamId: 't-1' },
    })
  })
})
