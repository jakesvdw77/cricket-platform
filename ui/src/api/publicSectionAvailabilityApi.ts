import api from './axiosConfig'
import type { AvailabilityStatus } from './matchAvailabilityApi'
import type { SectionAvailabilityRoundResponseRow } from './sectionAvailabilityApi'

// The public, unauthenticated side of docs/specs/063-section-availability-and-flexible-squads.md's
// Part A (fixture-group-selection revision) - `/api/v1/public/section-availability-rounds/**`,
// mirroring publicPollApi.ts's own shape exactly: no clubId anywhere, the round's own UUID is the
// entire access boundary. Built on the same shared `api` instance as every other resource file, per
// docs/standards/frontend.md.
export interface PublicSectionAvailabilityRound {
  roundId: string
  // The round's own title everywhere now, no bare date range in the header (Data Model Changes).
  description: string
  sectionName: string
  open: boolean
  // Every eligible player, with a status entry per bracket the round owns - a bracket only exists
  // at all if a real, admin-selected match put it there, so every entry here is always rendered,
  // no more hiding a zero-match bracket.
  responses: SectionAvailabilityRoundResponseRow[]
}

function roundPath(roundId: string): string {
  return `/public/section-availability-rounds/${roundId}`
}

export async function getRound(roundId: string): Promise<PublicSectionAvailabilityRound> {
  const { data } = await api.get<PublicSectionAvailabilityRound>(roundPath(roundId))
  return data
}

// Identifies the bracket by windowId directly rather than dayPart alone - a round can now own
// several windows sharing the same dayPart across different dates, ambiguous by dayPart alone,
// unambiguous by windowId.
export async function setAvailability(
  roundId: string,
  playerProfileId: string,
  windowId: string,
  status: AvailabilityStatus,
): Promise<PublicSectionAvailabilityRound> {
  const { data } = await api.put<PublicSectionAvailabilityRound>(`${roundPath(roundId)}/players/${playerProfileId}`, {
    windowId,
    status,
  })
  return data
}
