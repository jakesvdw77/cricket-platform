import type { QueryClient } from '@tanstack/react-query'
import api from './axiosConfig'

// docs/specs/081-plain-page-header-and-counters.md: the counters row on the Availability Polls view.
export interface AvailabilitySummary {
  openPolls: number
  playersResponded: number
  playersInAudience: number
  answersAwaited: number
  closingSoon: number
}

export const availabilitySummaryKey = (clubId: string) => ['managed-club', clubId, 'availability-summary'] as const

export async function getAvailabilitySummary(clubId: string): Promise<AvailabilitySummary> {
  const { data } = await api.get<AvailabilitySummary>(`/manage/clubs/${clubId}/availability/summary`)
  return data
}

// Call alongside any poll/round create, open, close, delete or response change so the counters and the
// Overview key figures refresh.
export function invalidateAvailabilityCounters(queryClient: QueryClient, clubId: string | undefined) {
  queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'availability-summary'] })
  queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'overview'] })
}
