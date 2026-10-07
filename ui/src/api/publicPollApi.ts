import api from './axiosConfig'
import {
  getPlayerAnswers,
  putPlayerAnswers,
  verifyPlayer,
} from './publicAvailabilityShared'
import type { PublicAnswer, PublicAnswers, VerifyRequest, VerifyResponse } from './publicAvailabilityShared'

export {
  readProblem,
  triesLeftOf,
  retryAfterSecondsOf,
  httpStatusOf,
} from './publicAvailabilityShared'
export type {
  PublicAnswer,
  PublicAnswers,
  VerifyRequest,
  VerifyResponse,
  PickCandidate,
  PublicProblem,
} from './publicAvailabilityShared'

// The public, unauthenticated side of docs/specs/032-match-availability-polls.md's squad poll,
// `/api/v1/public/polls/**`, reworked by docs/specs/077: the header carries no players or
// responses any more; a player proves who they are (verify), then reads and writes only their own
// answer with the short-lived token. The poll's own UUID is still the access boundary for the
// header.
export interface PublicAvailabilityPoll {
  pollId: string
  open: boolean
  clubId: string | null
  homeTeamName: string | null
  awayTeamName: string | null
  matchDate: string | null
  venue: string | null
  leagueName: string | null
  seasonLabel: string | null
  teamName: string | null
  scheduledCloseAt: string | null
}

export function pollPath(pollId: string): string {
  return `/public/polls/${pollId}`
}

export async function getPoll(pollId: string): Promise<PublicAvailabilityPoll> {
  const { data } = await api.get<PublicAvailabilityPoll>(pollPath(pollId))
  return data
}

export function verify(pollId: string, body: VerifyRequest): Promise<VerifyResponse> {
  return verifyPlayer(pollPath(pollId), body)
}

export function getAnswers(pollId: string, playerId: string, token: string): Promise<PublicAnswers> {
  return getPlayerAnswers(pollPath(pollId), playerId, token)
}

export function putAnswers(
  pollId: string,
  playerId: string,
  token: string,
  answers: PublicAnswer[],
): Promise<PublicAnswers> {
  return putPlayerAnswers(pollPath(pollId), playerId, token, answers)
}
