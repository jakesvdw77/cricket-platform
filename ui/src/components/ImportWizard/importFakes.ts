import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import api from '../../api/axiosConfig'
import { emptyImportDecisions } from '../../api/importApi'
import type { DeletionCheck, ImportBatch, ImportDecisions, ImportIssue, ImportRow, ImportType, ReferenceProposal } from '../../api/importApi'
import { DELETABLE, SAMPLE_ROWS, SAMPLE_TYPE, committedBatch, sampleBatch } from './importFixtures'

// docs/specs/097-import-framework.md: a fake handler layer for Storybook and tests, standing in for the import routes (no
// consumer exists yet). It installs an axios adapter on the shared instance, so importApi.ts runs unchanged. It validates
// the way the server would at a basic level: errors block a token, every warning code must be ticked, excluded rows drop out.

export interface FakeImportOptions {
  batch?: ImportBatch
  rows?: ImportRow[]
  deletion?: DeletionCheck
  history?: ImportBatch[]
  // The import types GET types returns; default: the sample type. A consumer's page test passes its own type.
  types?: ImportType[]
  // Makes the preview fail with this message (a file-level error).
  previewError?: string
  delayMs?: number
  // The proposals the batch has after its first decisions save (a name that appears once a row was edited or added).
  proposalsAfterSave?: ReferenceProposal[]
}

export interface FakeImportServer {
  calls: Array<{ method: string; url: string; params?: Record<string, unknown>; data?: unknown }>
  restore: () => void
}

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown, headers: Record<string, string> = {}): AxiosResponse {
  return { data, status, statusText: String(status), headers, config, request: {} }
}

function reject(config: InternalAxiosRequestConfig, status: number, body: Record<string, unknown>) {
  const response = respond(config, status, body)
  const error = Object.assign(new Error(`Request failed with status code ${status}`), { isAxiosError: true, response, config })
  return Promise.reject(error)
}

// Spec 125: the file rows with the edits laid over them (an edit equal to the file value is dropped, the file's text is kept in
// fileValues) and the typed-in rows appended.
export function effectiveRows(fileRows: ImportRow[], decisions: ImportDecisions): ImportRow[] {
  const edited = fileRows.map((fileRow) => {
    const edit = (decisions.rowEdits ?? []).find((candidate) => candidate.rowNumber === fileRow.rowNumber)
    const changed = Object.entries(edit?.values ?? {}).filter(([key, value]) => String(fileRow.values[key] ?? '') !== value)
    if (changed.length === 0) return { ...fileRow, origin: 'FILE' as const }
    return {
      ...fileRow,
      origin: 'EDITED' as const,
      values: { ...fileRow.values, ...Object.fromEntries(changed) },
      fileValues: Object.fromEntries(changed.map(([key]) => [key, fileRow.values[key] ?? ''])),
    }
  })
  const added: ImportRow[] = (decisions.addedRows ?? []).map((typed) => ({
    rowNumber: typed.rowNumber, sourceRef: null, values: typed.values, origin: 'ADDED', status: 'OK', outcome: 'NEW', action: 'CREATE', issueCodes: [], existingRef: null,
  }))
  return [...edited, ...added]
}

function evaluate(base: ImportBatch, decisions: ImportDecisions, revision: number, fileRows: ImportRow[], baseIssues: ImportIssue[]): ImportBatch {
  const rows = effectiveRows(fileRows, decisions)
  // A fake revalidation: an issue of a field the manager edited is taken as fixed.
  const fixed = (issue: ImportIssue) => issue.field !== null && issue.rowNumbers.length > 0 && issue.rowNumbers.every((number) => rows.find((row) => row.rowNumber === number)?.fileValues?.[issue.field as string] !== undefined)
  const issues = baseIssues.filter((issue) => !fixed(issue))
  const live = (rowNumbers: number[]) => rowNumbers.length === 0 || rowNumbers.some((row) => !decisions.excludedRows.includes(row))
  const errors = issues.filter((issue) => issue.severity === 'ERROR' && live(issue.rowNumbers))
  const warnings = issues.filter((issue) => issue.severity === 'WARNING' && live(issue.rowNumbers))
  const unacknowledged = warnings.filter((issue) => !decisions.acknowledgedWarnings.some((ack) => ack.code === issue.code))
  const committable = errors.length === 0 && unacknowledged.length === 0
  return {
    ...base,
    revision,
    decisions,
    issues,
    counts: {
      ...base.counts,
      rows: rows.length,
      errors: errors.length,
      warnings: warnings.length,
      excluded: decisions.excludedRows.length,
      edited: rows.filter((row) => row.origin === 'EDITED').length,
      added: rows.filter((row) => row.origin === 'ADDED').length,
    },
    confirmationToken: committable ? `token-${revision}` : null,
    creationsDigest: committable ? `digest-${revision}` : null,
  }
}

export function installFakeImportApi(options: FakeImportOptions = {}): FakeImportServer {
  const previous = api.defaults.adapter
  let batch = options.batch ?? sampleBatch()
  const initialRows = options.rows ?? SAMPLE_ROWS
  // The rows of the file behind the current batch (none for a blank batch).
  let fileRows = initialRows
  let baseIssues = batch.issues ?? []
  const deletion = options.deletion ?? DELETABLE
  const calls: FakeImportServer['calls'] = []

  const adapter: AxiosAdapter = async (config) => {
    const url = (config.url ?? '').replace(/^.*\/imports/, '')
    const method = (config.method ?? 'get').toLowerCase()
    calls.push({ method, url, params: config.params, data: config.data })
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs))
    const parts = url.split('/').filter(Boolean)

    if (method === 'get' && parts[0] === 'types') return respond(config, 200, options.types ?? [SAMPLE_TYPE])
    if (method === 'get' && parts[1] === 'template') {
      return respond(config, 200, new Blob(['template']), { 'content-disposition': `attachment; filename="${parts[0]}-template.${config.params?.format ?? 'xlsx'}"` })
    }
    if (method === 'get' && parts[1] === 'ai-help') return respond(config, 200, { type: parts[0], templateVersion: 1, prompt: 'Fill the attached template from my file.\nOne row per match.' })
    if (method === 'post' && parts[1] === 'preview') {
      if (options.previewError) return reject(config, 400, { detail: options.previewError })
      fileRows = initialRows
      baseIssues = options.batch?.issues ?? sampleBatch().issues ?? []
      batch = sampleBatch({ ...batch, status: 'PREVIEW', decisions: emptyImportDecisions() })
      return respond(config, 200, batch)
    }
    if (method === 'post' && parts[1] === 'blank') {
      fileRows = []
      baseIssues = []
      batch = sampleBatch({
        status: 'PREVIEW', source: 'MANUAL', fileName: 'Typed in the wizard', fileSizeBytes: 0, decisions: emptyImportDecisions(), issues: [], proposals: [], plannedChanges: [], firstRows: [],
        counts: { rows: 0, ok: 0, warnings: 0, errors: 0, created: 0, updated: 0, duplicates: 0, skippedNotOurs: 0, excluded: 0, edited: 0, added: 0 },
      })
      return respond(config, 200, batch)
    }
    if (method === 'get' && parts.length === 0) {
      const all = options.history ?? [batch, committedBatch({ id: 'batch-0', fileName: 'schedule-2025.xlsx', scopeMode: 'ALL' })]
      const content = config.params?.includeEnded ? all : all.filter((entry) => !['DELETED', 'DISCARDED', 'EXPIRED'].includes(entry.status))
      return respond(config, 200, { content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
    }
    const id = parts[0]
    if (method === 'get' && parts.length === 1) return respond(config, 200, { ...batch, id })
    if (method === 'get' && parts[1] === 'rows') {
      const status = String(config.params?.status ?? '').split(',').filter(Boolean)
      const outcome = String(config.params?.outcome ?? '').split(',').filter(Boolean)
      const filtered = effectiveRows(fileRows, batch.decisions).filter((row) => (status.length === 0 || status.includes(row.status)) && (outcome.length === 0 || (row.outcome !== null && outcome.includes(row.outcome))))
      const size = Number(config.params?.size ?? 50)
      const page = Number(config.params?.page ?? 0)
      return respond(config, 200, { content: filtered.slice(page * size, (page + 1) * size), totalElements: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / size)), number: page, size })
    }
    if (method === 'put' && parts[1] === 'decisions') {
      const body = (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) as { revision: number; decisions: ImportDecisions }
      batch = evaluate(batch, body.decisions, body.revision + 1, fileRows, baseIssues)
      if (options.proposalsAfterSave) batch = { ...batch, proposals: options.proposalsAfterSave }
      return respond(config, 200, batch)
    }
    if (method === 'post' && parts[1] === 'commit') {
      batch = committedBatch({ ...batch })
      return respond(config, 200, batch)
    }
    if (method === 'post' && parts[1] === 'discard') return respond(config, 200, { ...batch, status: 'DISCARDED' })
    if (method === 'get' && parts[1] === 'deletion-check') return respond(config, 200, deletion)
    if (method === 'post' && parts[1] === 'delete') {
      if (!deletion.deletable) return reject(config, 409, { detail: 'This import cannot be deleted because something it created is now in use.', blockers: deletion.blockers })
      batch = { ...batch, status: 'DELETED', deletedAt: '2026-10-28T09:00:00Z', counts: { ...batch.counts, deleted: deletion.willDelete, kept: deletion.willKeep } }
      return respond(config, 200, batch)
    }
    return reject(config, 404, { detail: `Fake import API has no route for ${method} ${url}` })
  }

  api.defaults.adapter = adapter
  return {
    calls,
    restore: () => {
      api.defaults.adapter = previous
    },
  }
}
