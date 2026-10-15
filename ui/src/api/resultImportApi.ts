import api from './axiosConfig'
import { resultsKey } from './matchResultApi'
import type { ResultSide, ResultValidation } from './matchResultApi'

// docs/specs/104-match-results-import-adaptors.md: the import wizard's three routes. Nothing here knows an adaptor, a
// format or a limit: the catalogue (GET adaptors) is the only source of them. The types mirror backend/openapi/openapi.yaml.

export type ImportExactness = 'EXACT' | 'NORMALISED' | 'AI_SUGGESTED' | 'UNRESOLVED'
export type ImportInputFormatName = string
export type ImportMatchReason = 'EXTERNAL_ID' | 'GIVEN' | 'DATE' | 'TEAMS' | 'VENUE' | 'COMPETITION'

export interface ImportInputFormat {
  format: ImportInputFormatName
  textBased: boolean
  extensions: string[]
  maxBytes: number
  acceptsPaste: boolean
}

export interface ImportAdaptor {
  type: string
  displayName: string
  description: string
  inputs: ImportInputFormat[]
  aiAllowed: boolean
  example: string | null
}

export interface ImportLimits {
  maxPasteCharacters: number
  maxFileBytes: number
  maxPlayersPerSide: number
  maxRegularInnings: number
  maxNameLength: number
  maxReportedErrors: number
}

export interface ImportCatalogue {
  adaptors: ImportAdaptor[]
  limits: ImportLimits
}

// The common import format, only as far as the wizard reads it. The document is otherwise opaque: it goes back to
// `resolve` exactly as `preview` returned it (the server re-validates everything and trusts none of it).
export interface ImportedResult {
  schemaVersion?: number
  source?: { adaptor?: string; provider?: string; externalMatchId?: string; fileName?: string }
  match?: { matchId?: string; date?: string; startTime?: string; venue?: string; competition?: string; exactness?: ImportExactness }
  teams?: Array<{ key: string; name: string; shortName?: string; exactness?: ImportExactness }>
  result?: {
    outcome?: string
    winner?: string
    decidedBy?: string
    margin?: { type?: 'RUNS' | 'WICKETS'; value?: number }
    note?: string
    exactness?: ImportExactness
  }
  [key: string]: unknown
}

export interface ExistingResult {
  matchId: string
  status: 'DRAFT' | 'PUBLISHED'
  source: string
  hasScorecard: boolean
  updatedAt: string
}

export interface MatchCandidate {
  matchId: string
  label: string
  matchDate: string
  homeName: string
  awayName: string
  leagueName: string | null
  venue: string | null
  reasons: ImportMatchReason[]
  existingResult: ExistingResult | null
}

export interface TeamMapping {
  fileKey: string
  fileName?: string
  side: ResultSide | null
  exactness?: ImportExactness
  reason?: string
}

export interface ImportNoteSuggestion {
  playerProfileId: string
  displayName: string
  score: number
}

export interface ImportNote {
  code: string
  severity: 'INFO' | 'WARNING'
  section: string
  message: string
  fileText?: string | null
  candidateName?: string | null
  level?: ImportExactness | null
  suggestions?: ImportNoteSuggestion[] | null
}

export interface ImportPreviewRequest {
  adaptor: string
  format: ImportInputFormatName
  content?: string
  matchId?: string
}

export interface ImportPreview {
  document: ImportedResult
  matchCandidates: MatchCandidate[]
  teamMapping: TeamMapping[]
  existingForExternalId: ExistingResult | null
  notes: ImportNote[]
}

export interface ImportResolveRequest {
  document: ImportedResult
  matchId: string
  teamMapping: Array<{ fileKey: string; side: ResultSide }>
  replaceExistingDraft: boolean
}

export interface ImportCounts {
  exact: number
  normalised: number
  aiSuggested: number
  unresolved: number
}

export interface ImportResolved {
  matchId: string
  resultStatus: 'DRAFT' | 'PUBLISHED'
  exactness: Record<string, ImportExactness>
  counts: ImportCounts
  notes: ImportNote[]
  validation: ResultValidation
}

function importPath(clubId: string): string {
  return `/manage/clubs/${clubId}/results/import`
}

// Under the results prefix so the capture wizard's own invalidation also refreshes it. The catalogue never changes while a
// page is open, so it is read once.
export const importKeys = {
  adaptors: (clubId: string) => [...resultsKey(clubId), 'import-adaptors'] as const,
}

// The registered adaptors and the limits. Reads no data of the club.
export async function getImportCatalogue(clubId: string): Promise<ImportCatalogue> {
  const { data } = await api.get<ImportCatalogue>(`${importPath(clubId)}/adaptors`)
  return data
}

// Multipart: the `request` part is JSON (a Blob of type application/json, so the server binds it as a body) and the optional
// `file` part is the upload. Exactly one of `file` and `request.content`. Writes nothing.
export async function previewImport(clubId: string, request: ImportPreviewRequest, file?: File | null): Promise<ImportPreview> {
  const formData = new FormData()
  formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }))
  if (file) formData.append('file', file)
  const { data } = await api.post<ImportPreview>(`${importPath(clubId)}/preview`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// The explicit confirm: saves one DRAFT for the chosen match. Never publishes.
export async function resolveImport(clubId: string, request: ImportResolveRequest): Promise<ImportResolved> {
  const { data } = await api.post<ImportResolved>(`${importPath(clubId)}/resolve`, request)
  return data
}
