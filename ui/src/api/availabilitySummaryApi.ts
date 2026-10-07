import type { QueryClient } from '@tanstack/react-query'
import api from './axiosConfig'

// docs/specs/081-plain-page-header-and-counters.md: the counters row on the Availability Polls view.
export interface AvailabilitySummary {
  openPolls: number
  playersResponded: number
  playersInAudience: number
  playersStillToAnswer: number
  closingSoon: number
}

// docs/specs/083: the counters describe exactly what the Polls list shows, so they take the same filters.
// openPolls then means "polls shown" (it includes closed ones when includeClosed is on).
export type AvailabilityPollTypeFilter = 'ALL' | 'GROUP' | 'SQUAD'

export interface AvailabilitySummaryFilters {
  leagueId?: string | null
  sectionId?: string | null
  teamId?: string | null
  type?: AvailabilityPollTypeFilter
  includeClosed?: boolean
}

// The poll type the two Polls toggles stand for. Both off cannot happen - the UI keeps one toggle on - so that
// case falls through to SQUAD rather than being modelled.
export function typeFilterFor(showGroup: boolean, showSquad: boolean): AvailabilityPollTypeFilter {
  if (showGroup && showSquad) return 'ALL'
  return showGroup ? 'GROUP' : 'SQUAD'
}

// Prefix-compatible with ['managed-club', clubId, 'availability-summary'] so invalidateAvailabilityCounters
// reaches every filter combination.
export const availabilitySummaryKey = (clubId: string, filters: AvailabilitySummaryFilters = {}) =>
  ['managed-club', clubId, 'availability-summary', filters] as const

// Only the filters that are set are sent; the server defaults are type ALL and includeClosed false.
export async function getAvailabilitySummary(
  clubId: string,
  filters: AvailabilitySummaryFilters = {},
): Promise<AvailabilitySummary> {
  const params: Record<string, string | boolean> = {}
  if (filters.leagueId) params.leagueId = filters.leagueId
  if (filters.sectionId) params.sectionId = filters.sectionId
  if (filters.teamId) params.teamId = filters.teamId
  if (filters.type && filters.type !== 'ALL') params.type = filters.type
  if (filters.includeClosed) params.includeClosed = true
  const { data } = await api.get<AvailabilitySummary>(`/manage/clubs/${clubId}/availability/summary`, { params })
  return data
}

// Call alongside any poll/round create, open, close, delete or response change so the counters and the
// Overview key figures refresh.
export function invalidateAvailabilityCounters(queryClient: QueryClient, clubId: string | undefined) {
  queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'availability-summary'] })
  queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'overview'] })
}
