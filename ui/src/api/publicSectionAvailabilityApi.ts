import api from './axiosConfig'
import {
  getPlayerAnswers,
  putPlayerAnswers,
  verifyPlayer,
} from './publicAvailabilityShared'
import type { PublicAnswer, PublicAnswers, VerifyRequest, VerifyResponse } from './publicAvailabilityShared'
import type { DayPart } from './sectionAvailabilityApi'

export {
  readProblem,
  triesLeftOf,
  retryAfterSecondsOf,
  httpStatusOf,
} from './publicAvailabilityShared'

// The public, unauthenticated side of docs/specs/063's group poll (a section availability round),
// `/api/v1/public/section-availability-rounds/**`, reworked by docs/specs/077 exactly like
// publicPollApi.ts: a header with the windows and their matches, then verify, then the player's
// own answers keyed by windowId.
export interface PublicRoundWindowMatch {
  homeTeamName: string | null
  awayTeamName: string | null
}

export interface PublicRoundWindow {
  windowId: string
  // yyyy-MM-dd
  windowDate: string
  dayPart: DayPart
  open: boolean
  matches: PublicRoundWindowMatch[]
}

export interface PublicSectionAvailabilityRound {
  roundId: string
  description: string | null
  sectionName: string | null
  open: boolean
  clubId: string | null
  scheduledCloseAt: string | null
  windows: PublicRoundWindow[]
}

export function roundPath(roundId: string): string {
  return `/public/section-availability-rounds/${roundId}`
}

export async function getRound(roundId: string): Promise<PublicSectionAvailabilityRound> {
  const { data } = await api.get<PublicSectionAvailabilityRound>(roundPath(roundId))
  return data
}

export function verify(roundId: string, body: VerifyRequest): Promise<VerifyResponse> {
  return verifyPlayer(roundPath(roundId), body)
}

export function getAnswers(roundId: string, playerId: string, token: string): Promise<PublicAnswers> {
  return getPlayerAnswers(roundPath(roundId), playerId, token)
}

export function putAnswers(
  roundId: string,
  playerId: string,
  token: string,
  answers: PublicAnswer[],
): Promise<PublicAnswers> {
  return putPlayerAnswers(roundPath(roundId), playerId, token, answers)
}
