import { isAxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import api from './axiosConfig'

// docs/specs/097-import-framework.md: the one API client of the import framework. Every type mirrors the backend DTOs
// (backend/openapi/openapi.yaml, dto/Import*Dto.java, ImportDecisionsDto, CommitImportRequest, DeleteImportRequest,
// AiHelpDto) and is typed by hand. Nothing here knows an import type: the type string and the scope params come from the
// consumer. Rows come only through the paginated rows endpoint; the batch never carries them beyond a first page.

export type ImportBatchStatus = 'PREVIEW' | 'COMMITTED' | 'DISCARDED' | 'EXPIRED' | 'DELETED'
export type ImportScopeMode = 'OURS_ONLY' | 'ALL'
export type ImportTemplateScope = 'OURS_ONLY' | 'OURS_AND_OTHERS'
export type ImportRowStatus = 'OK' | 'WARNING' | 'ERROR' | 'SKIPPED_NOT_OURS'
export type ImportOutcome = 'NEW' | 'DUPLICATE' | 'DIFFERS' | 'POSSIBLE_DUPLICATE' | 'SKIPPED_NOT_OURS'
export type ImportRowAction = 'CREATE' | 'SKIP' | 'UPDATE' | 'EXCLUDED'
export type ImportIssueSeverity = 'ERROR' | 'WARNING'
export type ImportResolutionKind = 'LINK' | 'CREATE' | 'SKIP_ROWS'
export type ImportEntityAction = 'CREATED' | 'UPDATED'
// ReferenceProposalDto.step: IDENTIFY_OURS for the "Identify what is ours" step, RESOLVE for the reference step.
export type ImportProposalStep = 'IDENTIFY_OURS' | 'RESOLVE'

export interface ImportFileLimits {
  maxFileBytes: number
  maxRows: number
  maxCellCharacters: number
  maxOpenPreviewsPerUser: number
  maxOpenPreviewsPerClub: number
  maxPreviewsPerClubPerHour: number
}

// ImportTypeDto.editableColumns (spec 125): the columns a manager may type into. `kind` only hints at the placeholder and keyboard;
// every value is plain text.
export type ImportEditableColumnKind = 'TEXT' | 'DATE' | 'TIME'

export interface ImportEditableColumn {
  key: string
  label: string
  kind: ImportEditableColumnKind
}

export interface ImportType {
  type: string
  label: string
  templateVersion: number
  formats: string[]
  supportsOursScope: boolean
  limits: ImportFileLimits
  // Rows can be edited, added and removed, and the type can start with no file (spec 125).
  editable?: boolean
  editableColumns?: ImportEditableColumn[]
}

// ImportScopeDto: what the consumer passes (for example leagueId and seasonId in params) plus the two scope choices.
export interface ImportScope {
  scopeMode?: ImportScopeMode | null
  templateScope?: ImportTemplateScope | null
  params: Record<string, string>
}

export interface ImportIssue {
  code: string
  severity: ImportIssueSeverity
  rowNumbers: number[]
  field: string | null
  message: string
  hint: string | null
}

// Where a row came from (spec 125): the file as uploaded, a file row the manager changed, or a row typed in the wizard.
export type ImportRowOrigin = 'FILE' | 'EDITED' | 'ADDED'
// Where the batch's rows came from; MANUAL is a batch started with no file.
export type ImportBatchSource = 'TEMPLATE_FILE' | 'AI_TRANSFORM' | 'MANUAL'

export interface ImportRow {
  rowNumber: number
  sourceRef: string | null
  values: Record<string, unknown>
  origin?: ImportRowOrigin
  // The file's original values of the changed keys; only on an EDITED row.
  fileValues?: Record<string, unknown>
  status: ImportRowStatus
  outcome: ImportOutcome | null
  action: ImportRowAction
  issueCodes: string[]
  existingRef: string | null
}

// Where a candidate was found (spec 098, "Where candidates come from"); optional, a type may not set it.
export type ReferenceCandidateSource = 'ALIAS' | 'OWN_AFFILIATED' | 'LEAGUE_THIS_SEASON' | 'LEAGUE_PREVIOUS_SEASON' | 'LEAGUE_OTHER' | 'OWN_OTHER'

// targetKind of a candidate or resolution that a consumer may use: OWN_TEAM and LEAGUE_TEAM link, COPY_LEAGUE_TEAM links by copying
// the source league team into this league and season, SISTER_TEAM is a hint only (no Link action).
export const TARGET_KIND_SISTER_TEAM = 'SISTER_TEAM'
export const TARGET_KIND_COPY_LEAGUE_TEAM = 'COPY_LEAGUE_TEAM'

export interface ReferenceCandidate {
  targetKind: string
  targetId: string
  targetName: string
  origin: string | null
  confidence: number
  reasons: string[]
  preselected: boolean
  source?: ReferenceCandidateSource | null
  seasonLabel?: string | null
  leagueName?: string | null
}

export interface ReferenceProposal {
  key: string
  value: string
  step: ImportProposalStep
  rowNumbers: number[]
  candidates: ReferenceCandidate[]
}

export interface PlannedChange {
  action: ImportEntityAction
  entityType: string
  label: string
  rowNumber: number | null
  detail: Record<string, unknown>
  changes: Record<string, unknown>
}

export interface ImportBatch {
  id: string
  clubId: string
  type: string
  templateVersion: number
  status: ImportBatchStatus
  scopeKey: string | null
  scope: Record<string, unknown> | null
  scopeMode: ImportScopeMode | null
  timeZone: string | null
  fileName: string | null
  fileSizeBytes: number
  source?: ImportBatchSource
  revision: number
  // rows, ok, warnings, errors, created, updated, duplicates, skippedNotOurs, excluded, edited, added; committedEntities after a commit;
  // deleted and kept (name to figure maps) after a delete.
  counts: Record<string, unknown>
  // Null on a history row (the payload is not loaded).
  issues: ImportIssue[] | null
  proposals: ReferenceProposal[] | null
  plannedChanges: PlannedChange[] | null
  fileWarnings: string[] | null
  // What the manager decided so far (never null; empty on a fresh batch). A reload or resume seeds the wizard from it.
  decisions: ImportDecisions
  earlierImportWarning: string | null
  firstRows: ImportRow[] | null
  // Present only on the response of a decisions save that left the batch committable.
  confirmationToken: string | null
  creationsDigest: string | null
  lastError: string | null
  createdBy: string | null
  createdAt: string | null
  expiresAt: string | null
  committedBy: string | null
  committedAt: string | null
  deletedBy: string | null
  deletedAt: string | null
}

export interface ImportResolution {
  key: string
  kind: ImportResolutionKind
  targetKind: string | null
  targetId: string | null
  // CREATE: the (tidied, editable) name; LINK: the label of the chosen candidate.
  targetName: string | null
  // CREATE only: an optional abbreviation for the new record.
  abbreviation?: string | null
  remember: boolean
}

export interface ImportRowUpdate {
  rowNumber: number
  attributes: string[]
}

export interface ImportAcknowledgement {
  code: string
  rowNumbers: number[]
}

// Spec 125: a manager's text for an editable column. In rowEdits only the changed keys; in addedRows every key typed.
export interface ImportRowValues {
  rowNumber: number
  values: Record<string, string>
}

export interface ImportDecisions {
  excludedRows: number[]
  identifiedAsOurs: string[]
  resolutions: ImportResolution[]
  updates: ImportRowUpdate[]
  updateAllDiffering: boolean
  acknowledgedWarnings: ImportAcknowledgement[]
  options: Record<string, unknown>
  rowEdits: ImportRowValues[]
  addedRows: ImportRowValues[]
}

export interface DeletionBlocker {
  entityType: string | null
  entityId: string | null
  label: string
  reasons: string[]
  detail: string | null
  link: string | null
}

export interface DeletionCheck {
  deletable: boolean
  blockers: DeletionBlocker[]
  willDelete: Record<string, number>
  willKeep: Record<string, number>
}

export interface AiHelp {
  type: string
  templateVersion: number
  prompt: string
}

// Spring Data's Page envelope.
export interface ImportPage<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export const IMPORT_ROWS_PAGE_SIZE = 50
export const IMPORT_HISTORY_PAGE_SIZE = 20

export interface ImportRowFilters {
  status?: ImportRowStatus[]
  outcome?: ImportOutcome[]
  page?: number
  size?: number
}

export interface ImportHistoryFilters {
  type?: string
  scopeKey?: string
  status?: ImportBatchStatus
  // Also list DELETED, DISCARDED and EXPIRED batches (the server leaves them out by default).
  includeEnded?: boolean
  page?: number
  size?: number
}

const importsPath = (clubId: string) => `/manage/clubs/${clubId}/imports`

export const importKeys = {
  all: (clubId: string) => ['managed-club', clubId, 'imports'] as const,
  types: (clubId: string) => [...importKeys.all(clubId), 'types'] as const,
  aiHelp: (clubId: string, type: string, scope: ImportScope) => [...importKeys.all(clubId), 'ai-help', type, scope.params, scope.templateScope ?? null] as const,
  batch: (clubId: string, batchId: string) => [...importKeys.all(clubId), 'batch', batchId] as const,
  rows: (clubId: string, batchId: string, revision: number, filters: ImportRowFilters) =>
    [...importKeys.all(clubId), 'batch', batchId, 'rows', revision, filters.status ?? [], filters.outcome ?? [], filters.page ?? 0] as const,
  history: (clubId: string, filters: ImportHistoryFilters) => [...importKeys.all(clubId), 'history', filters] as const,
  deletionCheck: (clubId: string, batchId: string) => [...importKeys.all(clubId), 'batch', batchId, 'deletion-check'] as const,
}

export function emptyImportDecisions(): ImportDecisions {
  return { excludedRows: [], identifiedAsOurs: [], resolutions: [], updates: [], updateAllDiffering: false, acknowledgedWarnings: [], options: {}, rowEdits: [], addedRows: [] }
}

// "3 typed in, 2 edited" from the batch counts (spec 125); null when nothing was typed or edited.
export function importTypedSummary(batch: Pick<ImportBatch, 'counts'> | null | undefined): string | null {
  const added = importCount(batch, 'added')
  const edited = importCount(batch, 'edited')
  const parts = [added > 0 ? `${added} typed in` : null, edited > 0 ? `${edited} edited` : null].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(', ') : null
}

// What the batch is called in a list or report: the file, or "Typed in the wizard" for a batch started with no file.
export function importSourceName(batch: Pick<ImportBatch, 'source' | 'fileName'>, fallback = 'Import'): string {
  return batch.source === 'MANUAL' ? 'Typed in the wizard' : batch.fileName ?? fallback
}

// A counter of the batch (counts is an open map), 0 when absent or not a number.
export function importCount(batch: Pick<ImportBatch, 'counts'> | null | undefined, key: string): number {
  const value = batch?.counts?.[key]
  return typeof value === 'number' ? value : 0
}

// The scope as query parameters of the template and ai-help routes: the consumer's params plus the two choices.
function scopeQuery(scope: ImportScope): Record<string, string> {
  const query: Record<string, string> = { ...scope.params }
  if (scope.templateScope) query.templateScope = scope.templateScope
  if (scope.scopeMode) query.scopeMode = scope.scopeMode
  return query
}

export async function listImportTypes(clubId: string): Promise<ImportType[]> {
  const { data } = await api.get<ImportType[]>(`${importsPath(clubId)}/types`)
  return data
}

export interface ImportTemplateFile {
  blob: Blob
  fileName: string
}

function fileNameOf(disposition: unknown, fallback: string): string {
  if (typeof disposition !== 'string') return fallback
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (star) {
    try {
      return decodeURIComponent(star[1])
    } catch {
      return star[1]
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  return plain ? plain[1] : fallback
}

export async function downloadImportTemplate(clubId: string, type: string, format: string, scope: ImportScope): Promise<ImportTemplateFile> {
  const response = await api.get<Blob>(`${importsPath(clubId)}/${type}/template`, {
    params: { ...scopeQuery(scope), format },
    responseType: 'blob',
  })
  return { blob: response.data, fileName: fileNameOf(response.headers?.['content-disposition'], `${type}-template.${format}`) }
}

export async function getAiHelp(clubId: string, type: string, scope: ImportScope): Promise<AiHelp> {
  const { data } = await api.get<AiHelp>(`${importsPath(clubId)}/${type}/ai-help`, { params: scopeQuery(scope) })
  return data
}

// Multipart: `file` plus a `scope` JSON part (a Blob of type application/json, as resultImportApi does for its request) and
// the optional IANA `timeZone`. Writes only a PREVIEW batch.
export async function previewImport(clubId: string, type: string, file: File, scope: ImportScope, timeZone?: string): Promise<ImportBatch> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('scope', new Blob([JSON.stringify({ scopeMode: scope.scopeMode ?? null, templateScope: scope.templateScope ?? null, params: scope.params })], { type: 'application/json' }))
  const { data } = await api.post<ImportBatch>(`${importsPath(clubId)}/${type}/preview`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: timeZone ? { timeZone } : undefined,
  })
  return data
}

// Spec 125: starts a PREVIEW batch with no rows and no file (source MANUAL); the same scope object as the preview's `scope` part.
export async function startBlankImport(clubId: string, type: string, scope: ImportScope, timeZone?: string): Promise<ImportBatch> {
  const { data } = await api.post<ImportBatch>(
    `${importsPath(clubId)}/${type}/blank`,
    { scopeMode: scope.scopeMode ?? null, templateScope: scope.templateScope ?? null, params: scope.params },
    { params: timeZone ? { timeZone } : undefined },
  )
  return data
}

export async function getImportBatch(clubId: string, batchId: string): Promise<ImportBatch> {
  const { data } = await api.get<ImportBatch>(`${importsPath(clubId)}/${batchId}`)
  return data
}

// Filters are sent comma separated ("status=ERROR,WARNING"), the form the spec's rows route documents.
export async function listImportRows(clubId: string, batchId: string, filters: ImportRowFilters = {}): Promise<ImportPage<ImportRow>> {
  const params: Record<string, string | number> = { page: filters.page ?? 0, size: filters.size ?? IMPORT_ROWS_PAGE_SIZE }
  if (filters.status?.length) params.status = filters.status.join(',')
  if (filters.outcome?.length) params.outcome = filters.outcome.join(',')
  const { data } = await api.get<ImportPage<ImportRow>>(`${importsPath(clubId)}/${batchId}/rows`, { params })
  return data
}

// Every page of the rows endpoint in turn (50 each, at most 1,000 rows): only for the "rows not imported" file, never for display.
export async function listAllImportRows(clubId: string, batchId: string): Promise<ImportRow[]> {
  const rows: ImportRow[] = []
  for (let page = 0; ; page += 1) {
    const result = await listImportRows(clubId, batchId, { page })
    rows.push(...result.content)
    if (page + 1 >= result.totalPages) return rows
  }
}

export async function saveImportDecisions(clubId: string, batchId: string, revision: number, decisions: ImportDecisions): Promise<ImportBatch> {
  const { data } = await api.put<ImportBatch>(`${importsPath(clubId)}/${batchId}/decisions`, { revision, decisions })
  return data
}

export async function commitImport(clubId: string, batchId: string, request: { revision: number; confirmationToken: string; confirmedCreationsDigest: string }): Promise<ImportBatch> {
  const { data } = await api.post<ImportBatch>(`${importsPath(clubId)}/${batchId}/commit`, request)
  return data
}

export async function discardImport(clubId: string, batchId: string): Promise<ImportBatch> {
  const { data } = await api.post<ImportBatch>(`${importsPath(clubId)}/${batchId}/discard`)
  return data
}

export async function listImportHistory(clubId: string, filters: ImportHistoryFilters = {}): Promise<ImportPage<ImportBatch>> {
  const params: Record<string, string | number | boolean> = { page: filters.page ?? 0, size: filters.size ?? IMPORT_HISTORY_PAGE_SIZE }
  if (filters.type) params.type = filters.type
  if (filters.scopeKey) params.scopeKey = filters.scopeKey
  if (filters.status) params.status = filters.status
  if (filters.includeEnded) params.includeEnded = true
  const { data } = await api.get<ImportPage<ImportBatch>>(importsPath(clubId), { params })
  return data
}

export async function getDeletionCheck(clubId: string, batchId: string): Promise<DeletionCheck> {
  const { data } = await api.get<DeletionCheck>(`${importsPath(clubId)}/${batchId}/deletion-check`)
  return data
}

export async function deleteImport(clubId: string, batchId: string): Promise<ImportBatch> {
  const { data } = await api.post<ImportBatch>(`${importsPath(clubId)}/${batchId}/delete`, { confirm: true })
  return data
}

// What a failed import call says, for an Alert: the ProblemDetail's detail, else a plain fallback. Never an object.
export function importErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!isAxiosError(error)) return fallback
  if (!error.response) return "We couldn't reach the server. Check your connection and try again."
  const body = (error.response.data ?? {}) as Record<string, unknown>
  const detail = typeof body.detail === 'string' && body.detail.trim() ? body.detail : typeof body.message === 'string' ? body.message : ''
  return detail.trim() || fallback
}

// The blockers an ImportDeletionBlockedException (409) carries, or an empty list for any other error.
export function importDeletionBlockers(error: unknown): DeletionBlocker[] {
  if (!isAxiosError(error)) return []
  const body = (error.response?.data ?? {}) as Record<string, unknown>
  return Array.isArray(body.blockers) ? (body.blockers as DeletionBlocker[]) : []
}

export function importErrorStatus(error: unknown): number | null {
  return isAxiosError(error) ? (error.response?.status ?? null) : null
}

function invalidateAll(queryClient: QueryClient, clubId: string, extra: QueryKey[] | undefined) {
  void queryClient.invalidateQueries({ queryKey: importKeys.all(clubId) })
  for (const key of extra ?? []) void queryClient.invalidateQueries({ queryKey: key })
}

export function useImportTypes(clubId: string) {
  return useQuery({ queryKey: importKeys.types(clubId), queryFn: () => listImportTypes(clubId), enabled: Boolean(clubId), staleTime: 5 * 60_000 })
}

export function useAiHelp(clubId: string, type: string, scope: ImportScope, enabled = true) {
  return useQuery({ queryKey: importKeys.aiHelp(clubId, type, scope), queryFn: () => getAiHelp(clubId, type, scope), enabled: enabled && Boolean(clubId) && Boolean(type), staleTime: 5 * 60_000 })
}

export function useImportBatch(clubId: string, batchId: string | null) {
  return useQuery({ queryKey: importKeys.batch(clubId, batchId ?? ''), queryFn: () => getImportBatch(clubId, batchId as string), enabled: Boolean(clubId) && Boolean(batchId),
    // The batch in the cache is the last decisions save, which alone carries the confirmation token: a focus refetch would drop it.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useImportRows(clubId: string, batchId: string, revision: number, filters: ImportRowFilters, enabled = true) {
  return useQuery({
    queryKey: importKeys.rows(clubId, batchId, revision, filters),
    queryFn: () => listImportRows(clubId, batchId, filters),
    enabled: enabled && Boolean(clubId) && Boolean(batchId),
    placeholderData: (previous) => previous,
  })
}

export function useImportHistory(clubId: string, filters: ImportHistoryFilters, enabled = true) {
  return useQuery({ queryKey: importKeys.history(clubId, filters), queryFn: () => listImportHistory(clubId, filters), enabled: enabled && Boolean(clubId) })
}

export function useDeletionCheck(clubId: string, batchId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: importKeys.deletionCheck(clubId, batchId ?? ''),
    queryFn: () => getDeletionCheck(clubId, batchId as string),
    enabled: enabled && Boolean(batchId),
    // A check is never reused: it must reflect what depends on the import now.
    gcTime: 0,
    staleTime: 0,
  })
}

// The preview creates the batch: it is put straight into the cache so the wizard opens on it without another call.
export function usePreviewImport(clubId: string, type: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, scope, timeZone }: { file: File; scope: ImportScope; timeZone?: string }) => previewImport(clubId, type, file, scope, timeZone),
    onSuccess: (batch) => {
      queryClient.setQueryData(importKeys.batch(clubId, batch.id), batch)
      void queryClient.invalidateQueries({ queryKey: [...importKeys.all(clubId), 'history'] })
    },
  })
}

// Like the preview, the blank batch is put straight into the cache.
export function useStartBlankImport(clubId: string, type: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ scope, timeZone }: { scope: ImportScope; timeZone?: string }) => startBlankImport(clubId, type, scope, timeZone),
    onSuccess: (batch) => {
      queryClient.setQueryData(importKeys.batch(clubId, batch.id), batch)
      void queryClient.invalidateQueries({ queryKey: [...importKeys.all(clubId), 'history'] })
    },
  })
}

// Each save returns the re-validated batch (new revision, issues, proposals, and a token when committable): it replaces the cache entry.
export function useSaveImportDecisions(clubId: string, batchId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ revision, decisions }: { revision: number; decisions: ImportDecisions }) => saveImportDecisions(clubId, batchId, revision, decisions),
    onSuccess: (batch) => queryClient.setQueryData(importKeys.batch(clubId, batchId), batch),
    // A revision conflict or a lost connection: read the batch again so the screen shows what the server holds.
    onError: () => void queryClient.invalidateQueries({ queryKey: importKeys.batch(clubId, batchId), exact: true }),
  })
}

// `invalidateKeys` are the keys of the data the import changed (the consumer's matches, teams ...).
export function useCommitImport(clubId: string, batchId: string, invalidateKeys?: QueryKey[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: { revision: number; confirmationToken: string; confirmedCreationsDigest: string }) => commitImport(clubId, batchId, request),
    onSuccess: (batch) => {
      queryClient.setQueryData(importKeys.batch(clubId, batchId), batch)
      invalidateAll(queryClient, clubId, invalidateKeys)
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: importKeys.batch(clubId, batchId), exact: true }),
  })
}

export function useDiscardImport(clubId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (batchId: string) => discardImport(clubId, batchId),
    onSuccess: () => invalidateAll(queryClient, clubId, undefined),
  })
}

export function useDeleteImport(clubId: string, invalidateKeys?: QueryKey[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (batchId: string) => deleteImport(clubId, batchId),
    onSuccess: () => invalidateAll(queryClient, clubId, invalidateKeys),
  })
}
