import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { listMyPlayerFields } from './myPlayersApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

describe('myPlayersApi', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  // The axios baseURL already adds /api/v1; a second /v1 here once shipped and broke the Field Directory.
  it('asks for the fields of a player at /me/players/{key}/fields, with no extra version prefix', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })

    await expect(listMyPlayerFields('k1')).resolves.toEqual([])

    expect(api.get).toHaveBeenCalledWith('/me/players/k1/fields')
    expect(vi.mocked(api.get).mock.calls[0][0]).not.toMatch(/\/v1\//)
  })
})
