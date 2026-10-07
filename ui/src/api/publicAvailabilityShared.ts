import { isAxiosError } from 'axios'
import api from './axiosConfig'
import type { AvailabilityStatus } from './matchAvailabilityApi'

// docs/specs/077-public-availability-form-verification.md: the verify / answers contract is the
// same for the squad poll (`/public/polls/{id}`) and the group poll
// (`/public/section-availability-rounds/{id}`), so both resource files share this one helper
// instead of two copies. All of it runs on the shared `api` instance, unauthenticated.

export interface VerifyRequest {
  firstName: string
  lastName: string
  // yyyy-MM-dd
  dateOfBirth: string
  // Only set when repeating the call after a PICK response.
  playerId?: string
}

export interface PickCandidate {
  playerId: string
  shirtNumber: number | null
  teamLabel: string | null
}

export interface VerifiedResponse {
  status: 'VERIFIED'
  playerId: string
  firstName: string
  lastName: string
  token: string
  expiresAt: string
}

export interface PickResponse {
  status: 'PICK'
  candidates: PickCandidate[]
}

export interface NoDateOfBirthResponse {
  status: 'NO_DATE_OF_BIRTH'
}

export type VerifyResponse = VerifiedResponse | PickResponse | NoDateOfBirthResponse

// windowId is null for a squad poll (exactly one answer), the window's id for a group poll.
export interface PublicAnswer {
  windowId: string | null
  status: AvailabilityStatus
}

export interface PublicAnswers {
  answers: PublicAnswer[]
}

export const PUBLIC_TOKEN_HEADER = 'X-Public-Token'

export async function verifyPlayer(basePath: string, body: VerifyRequest): Promise<VerifyResponse> {
  const { data } = await api.post<VerifyResponse>(`${basePath}/verify`, body)
  return data
}

function answersPath(basePath: string, playerId: string): string {
  return `${basePath}/players/${playerId}/answers`
}

export async function getPlayerAnswers(basePath: string, playerId: string, token: string): Promise<PublicAnswers> {
  const { data } = await api.get<PublicAnswers>(answersPath(basePath, playerId), {
    headers: { [PUBLIC_TOKEN_HEADER]: token },
  })
  return data
}

export async function putPlayerAnswers(
  basePath: string,
  playerId: string,
  token: string,
  answers: PublicAnswer[],
): Promise<PublicAnswers> {
  const { data } = await api.put<PublicAnswers>(
    answersPath(basePath, playerId),
    { answers },
    { headers: { [PUBLIC_TOKEN_HEADER]: token } },
  )
  return data
}

// What the public screens need from a failed request. triesLeft is on the 403 ProblemDetail,
// retryAfterSeconds on the 423 and 429 ones; either is undefined when the body does not carry it.
export interface PublicProblem {
  status: number | null
  detail?: string
  triesLeft?: number
  retryAfterSeconds?: number
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function readProblem(error: unknown): PublicProblem {
  if (!isAxiosError(error)) return { status: null }
  const body = (error.response?.data ?? {}) as Record<string, unknown>
  return {
    status: error.response?.status ?? null,
    detail: typeof body.detail === 'string' ? body.detail : undefined,
    triesLeft: numberOrUndefined(body.triesLeft),
    retryAfterSeconds: numberOrUndefined(body.retryAfterSeconds),
  }
}

export function triesLeftOf(error: unknown): number | undefined {
  return readProblem(error).triesLeft
}

export function retryAfterSecondsOf(error: unknown): number | undefined {
  return readProblem(error).retryAfterSeconds
}

export function httpStatusOf(error: unknown): number | null {
  return readProblem(error).status
}
