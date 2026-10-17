import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useShareResultData } from './useShareResultData'
import { makeMatch, makeResult } from '../pages/manage/results/resultTestUtils'

const listLeagues = vi.fn()
const listSections = vi.fn()
const forbidden = () => Promise.reject(new Error('403'))

vi.mock('../api/leagueApi', () => ({ listLeagues: (clubId: string) => listLeagues(clubId) }))
vi.mock('../api/sectionApi', () => ({ listSections: (clubId: string) => listSections(clubId) }))
vi.mock('../api/clubApi', () => ({ getManagedClubProfile: () => forbidden() }))
vi.mock('../api/sponsorApi', () => ({ listSponsors: () => forbidden() }))
vi.mock('../api/teamSponsorApi', () => ({
  listTeamSponsors: () => Promise.resolve([{ id: 's1', name: 'Acme', active: true, logoUrl: 'logo.png' }]),
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)
const teams = new Map([['team-1', { id: 'team-1', sectionId: 'sec-1', name: '1st XI', logoUrl: null } as never]])

beforeEach(() => {
  listLeagues.mockReset()
  listSections.mockReset()
})

describe('useShareResultData', () => {
  it('fails safe to junior when the league cannot be read, and tolerates 403s on the other reads', async () => {
    listLeagues.mockImplementation(forbidden)
    listSections.mockImplementation(forbidden)
    const match = makeMatch({ id: 'match-1', homeTeamId: 'team-1', leagueId: 'league-1' })
    const { result } = renderHook(() => useShareResultData('club-1', match, makeResult(), teams, true), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.league).toBeUndefined()
    expect(result.current.clubProfile).toBeUndefined()
    expect(result.current.junior).toEqual({ junior: true, reason: 'UNAVAILABLE' })
    expect(result.current.sponsors.map((sponsor) => sponsor.id)).toEqual(['s1'])
    expect(result.current.defaultSponsorId).toBe('s1')
  })

  it('treats a match with no league as null and reads nothing while closed', async () => {
    listSections.mockResolvedValue([{ id: 'sec-1', parentSectionId: null, name: 'Seniors', maxAge: null }])
    const match = makeMatch({ id: 'match-1', homeTeamId: 'team-1', leagueId: null })
    const closed = renderHook(() => useShareResultData('club-1', match, makeResult(), teams, false), { wrapper })
    expect(listSections).not.toHaveBeenCalled()
    expect(closed.result.current.isLoading).toBe(false)

    const { result } = renderHook(() => useShareResultData('club-1', match, makeResult(), teams, true), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.league).toBeNull()
    expect(result.current.junior.junior).toBe(false)
  })
})
