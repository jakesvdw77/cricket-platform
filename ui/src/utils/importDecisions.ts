import { TARGET_KIND_COPY_LEAGUE_TEAM, emptyImportDecisions } from '../api/importApi'
import type { ImportAcknowledgement, ImportBatch, ImportDecisions, ImportIssue, ImportResolution, ReferenceProposal } from '../api/importApi'

// docs/specs/097-import-framework.md: pure helpers over the decisions a manager makes in the import wizard. The wizard
// holds one ImportDecisions and sends the whole of it on every change (PUT decisions), so each helper returns a new value.

export function resolutionFor(decisions: ImportDecisions, key: string): ImportResolution | undefined {
  return decisions.resolutions.find((resolution) => resolution.key === key)
}

export function withResolution(decisions: ImportDecisions, resolution: ImportResolution): ImportDecisions {
  return { ...decisions, resolutions: [...decisions.resolutions.filter((existing) => existing.key !== resolution.key), resolution] }
}

export function withoutResolution(decisions: ImportDecisions, key: string): ImportDecisions {
  return { ...decisions, resolutions: decisions.resolutions.filter((existing) => existing.key !== key) }
}

export function withIdentifiedAsOurs(decisions: ImportDecisions, key: string, ours: boolean): ImportDecisions {
  const others = decisions.identifiedAsOurs.filter((existing) => existing !== key)
  return { ...decisions, identifiedAsOurs: ours ? [...others, key] : others }
}

export function toggleExcluded(decisions: ImportDecisions, rowNumber: number): ImportDecisions {
  const excluded = decisions.excludedRows.includes(rowNumber)
  return { ...decisions, excludedRows: excluded ? decisions.excludedRows.filter((row) => row !== rowNumber) : [...decisions.excludedRows, rowNumber] }
}

// A differing row is updated only when the manager opts in (spec: update is opt-in).
export function toggleUpdate(decisions: ImportDecisions, rowNumber: number): ImportDecisions {
  const on = decisions.updates.some((update) => update.rowNumber === rowNumber)
  return { ...decisions, updates: on ? decisions.updates.filter((update) => update.rowNumber !== rowNumber) : [...decisions.updates, { rowNumber, attributes: [] }] }
}

// Spec 125: edits and added rows are decisions. Added rows are numbered from 1001 (above the 1,000-row file limit).
export const FIRST_ADDED_ROW = 1001

export function isAddedRowNumber(rowNumber: number): boolean {
  return rowNumber >= FIRST_ADDED_ROW
}

// The next number for an added row: above every added row now present and above `used` (the highest number this session handed
// out, so a removed row's number is not reused).
export function nextAddedRowNumber(decisions: ImportDecisions, used = 0): number {
  return Math.max(FIRST_ADDED_ROW - 1, used, ...(decisions.addedRows ?? []).map((row) => row.rowNumber)) + 1
}

// Records an edit. Only the keys given are changed; an earlier edit of the same row keeps its other keys. An added row keeps all
// its values in addedRows, so an edit of one is merged there. An empty edit changes nothing.
export function withRowEdit(decisions: ImportDecisions, rowNumber: number, values: Record<string, string>): ImportDecisions {
  if (Object.keys(values).length === 0) return decisions
  const added = (decisions.addedRows ?? []).find((row) => row.rowNumber === rowNumber)
  if (added) return { ...decisions, addedRows: decisions.addedRows.map((row) => (row.rowNumber === rowNumber ? { rowNumber, values: { ...row.values, ...values } } : row)) }
  const existing = (decisions.rowEdits ?? []).find((row) => row.rowNumber === rowNumber)
  const edit = { rowNumber, values: { ...(existing?.values ?? {}), ...values } }
  return { ...decisions, rowEdits: [...(decisions.rowEdits ?? []).filter((row) => row.rowNumber !== rowNumber), edit] }
}

// Reset to file values.
export function withoutRowEdit(decisions: ImportDecisions, rowNumber: number): ImportDecisions {
  return { ...decisions, rowEdits: (decisions.rowEdits ?? []).filter((row) => row.rowNumber !== rowNumber) }
}

export function withAddedRow(decisions: ImportDecisions, row: { rowNumber: number; values: Record<string, string> }): ImportDecisions {
  return { ...decisions, addedRows: [...(decisions.addedRows ?? []).filter((existing) => existing.rowNumber !== row.rowNumber), row] }
}

// Removing an added row deletes it (and any exclusion of it); a file row is removed by Exclude.
export function removeAddedRow(decisions: ImportDecisions, rowNumber: number): ImportDecisions {
  return { ...decisions, addedRows: (decisions.addedRows ?? []).filter((row) => row.rowNumber !== rowNumber), excludedRows: decisions.excludedRows.filter((row) => row !== rowNumber) }
}

// Every distinct row the non-excluded issues of this code concern; an empty list means a file-level warning with no rows.
export function rowsOfCode(issues: ImportIssue[], code: string, excluded: number[]): number[] {
  const rows = new Set<number>()
  for (const issue of issues) {
    if (issue.code !== code) continue
    for (const row of issue.rowNumbers) if (!excluded.includes(row)) rows.add(row)
  }
  return [...rows].sort((a, b) => a - b)
}

// The same test the server applies: an acknowledgement with no rows covers the code; otherwise it must cover every live row.
export function isAcknowledged(decisions: ImportDecisions, issues: ImportIssue[], code: string): boolean {
  const live = rowsOfCode(issues, code, decisions.excludedRows)
  return decisions.acknowledgedWarnings.some((ack) => ack.code === code && (ack.rowNumbers.length === 0 || live.every((row) => ack.rowNumbers.includes(row))))
}

export function withAcknowledgement(decisions: ImportDecisions, issues: ImportIssue[], code: string, acknowledged: boolean): ImportDecisions {
  const others: ImportAcknowledgement[] = decisions.acknowledgedWarnings.filter((ack) => ack.code !== code)
  return { ...decisions, acknowledgedWarnings: acknowledged ? [...others, { code, rowNumbers: rowsOfCode(issues, code, decisions.excludedRows) }] : others }
}

export interface WarningGroup {
  code: string
  message: string
  rowNumbers: number[]
  hint: string | null
  acknowledged: boolean
}

// Warnings grouped by code (one tick each). A file-level warning (no rows) is a group of its own.
export function warningGroups(issues: ImportIssue[], decisions: ImportDecisions): WarningGroup[] {
  const groups = new Map<string, WarningGroup>()
  for (const issue of issues) {
    if (issue.severity !== 'WARNING') continue
    const live = issue.rowNumbers.filter((row) => !decisions.excludedRows.includes(row))
    if (issue.rowNumbers.length > 0 && live.length === 0) continue
    const existing = groups.get(issue.code)
    if (existing) {
      existing.rowNumbers = [...new Set([...existing.rowNumbers, ...live])].sort((a, b) => a - b)
    } else {
      groups.set(issue.code, { code: issue.code, message: issue.message, rowNumbers: [...live].sort((a, b) => a - b), hint: issue.hint, acknowledged: isAcknowledged(decisions, issues, issue.code) })
    }
  }
  return [...groups.values()]
}

export function errorCount(issues: ImportIssue[], decisions: ImportDecisions): number {
  return issues.filter((issue) => issue.severity === 'ERROR' && (issue.rowNumbers.length === 0 || issue.rowNumbers.some((row) => !decisions.excludedRows.includes(row)))).length
}

// Issue codes the resolution steps (Identify ours, Match teams) clear, so Check rows must not block on them: the server flags
// every name as TEAM_UNRESOLVED until its decisions are saved (spec 098). Review and the server still treat them as errors.
export const RESOLUTION_STEP_CODES: string[] = ['TEAM_UNRESOLVED']

// The errors that block Check rows: errorCount without the codes a later step resolves.
export function blockingErrorCount(issues: ImportIssue[], decisions: ImportDecisions, deferredCodes: string[] = RESOLUTION_STEP_CODES): number {
  return errorCount(issues.filter((issue) => !deferredCodes.includes(issue.code)), decisions)
}

// Rows whose only errors are of a deferred code: they wait for a later step rather than failing.
export function pendingResolutionRows(issues: ImportIssue[], deferredCodes: string[] = RESOLUTION_STEP_CODES): Set<number> {
  const blocked = new Set<number>()
  const pending = new Set<number>()
  for (const issue of issues) {
    if (issue.severity !== 'ERROR') continue
    for (const row of issue.rowNumbers) (deferredCodes.includes(issue.code) ? pending : blocked).add(row)
  }
  for (const row of blocked) pending.delete(row)
  return pending
}

// The decisions a fresh batch starts with: an exact match or a remembered alias (the only preselected candidate) is taken as
// the manager's choice, still shown on its card and still counted. Anything else waits for the manager. Existing choices win.
export function seedDecisions(proposals: ReferenceProposal[], existing: ImportDecisions = emptyImportDecisions()): ImportDecisions {
  let next = existing
  for (const proposal of proposals) {
    const chosen = proposal.candidates.find((candidate) => candidate.preselected)
    if (!chosen) continue
    if (proposal.step === 'IDENTIFY_OURS') {
      if (!next.identifiedAsOurs.includes(proposal.key)) next = withIdentifiedAsOurs(next, proposal.key, true)
    }
    if (!resolutionFor(next, proposal.key)) {
      next = withResolution(next, { key: proposal.key, kind: 'LINK', targetKind: chosen.targetKind, targetId: chosen.targetId, targetName: chosen.targetName, remember: false })
    }
  }
  return next
}

// Ranked best first; the server's order is kept for equal confidence.
export function rankedCandidates(proposal: ReferenceProposal) {
  return proposal.candidates.map((candidate, index) => ({ candidate, index })).sort((a, b) => b.candidate.confidence - a.candidate.confidence || a.index - b.index).map((entry) => entry.candidate)
}

// Whether a card of the resolver has been decided: a resolution of any kind, or (Identify what is ours) ticked ours or marked not ours.
export function isProposalResolved(proposal: ReferenceProposal, decisions: ImportDecisions, notOurs: string[] = []): boolean {
  if (proposal.step === 'IDENTIFY_OURS') return decisions.identifiedAsOurs.includes(proposal.key) || notOurs.includes(proposal.key)
  return Boolean(resolutionFor(decisions, proposal.key))
}

export function hasDecisions(decisions: ImportDecisions): boolean {
  return decisions.excludedRows.length + decisions.identifiedAsOurs.length + decisions.resolutions.length + decisions.updates.length + decisions.acknowledgedWarnings.length + (decisions.rowEdits?.length ?? 0) + (decisions.addedRows?.length ?? 0) + Object.keys(decisions.options ?? {}).length > 0 || decisions.updateAllDiffering
}

// "Not ours" is not stored: it is an Identify card left without a resolution once the manager has ticked at least one value as
// ours. With nothing ticked it cannot be told from "not decided yet", so it is left empty.
export function deriveNotOurs(proposals: ReferenceProposal[], decisions: ImportDecisions): string[] {
  if (decisions.identifiedAsOurs.length === 0) return []
  return proposals.filter((proposal) => proposal.step === 'IDENTIFY_OURS' && !decisions.identifiedAsOurs.includes(proposal.key) && !resolutionFor(decisions, proposal.key)).map((proposal) => proposal.key)
}

export type ResumeStep = 'rows' | 'identify' | 'resolve' | 'review'

// Where a resumed PREVIEW opens: Check rows when nothing is decided or rows still have errors, Identify ours or Match teams
// while references are unresolved, Review once the batch could be committed (no live errors, every warning acknowledged).
export function resumeStepFor(batch: Pick<ImportBatch, 'issues' | 'proposals'>, decisions: ImportDecisions, notOurs: string[], identifies: boolean): ResumeStep {
  if (!hasDecisions(decisions)) return 'rows'
  const issues = batch.issues ?? []
  if (blockingErrorCount(issues, decisions) > 0) return 'rows'
  const proposals = batch.proposals ?? []
  const open = (step: ReferenceProposal['step']) => proposals.some((proposal) => proposal.step === step && !isProposalResolved(proposal, decisions, notOurs))
  if (identifies && open('IDENTIFY_OURS')) return 'identify'
  if (open('RESOLVE')) return 'resolve'
  if (warningGroups(issues, decisions).some((group) => !group.acknowledged)) return 'rows'
  return 'review'
}

export type ConfidenceBand = 'Exact' | 'High' | 'Medium' | 'Low'

// The band a candidate's confidence falls in (spec 098): Exact 100, High 90 to 99, Medium 70 to 89, Low below 70.
export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 100) return 'Exact'
  if (confidence >= 90) return 'High'
  if (confidence >= 70) return 'Medium'
  return 'Low'
}

// Spec 125 amendment 2026-10-30: a type-ahead option may carry an identity (an own team or a league team with its id). Choosing one
// settles that name in the same save as the row edit. A plain string, or an option without an identity, records nothing.
export interface ImportColumnOption {
  label: string
  kind?: 'OWN_TEAM' | 'LEAGUE_TEAM'
  id?: string
}

export type ImportColumnOptions = Record<string, Array<string | ImportColumnOption>>

// What the editor reports for one chosen option: the name as shown and the record it is.
export interface ImportOptionPick {
  name: string
  kind: string
  id: string
}

const hasIdentity = (option: ImportColumnOption) => Boolean(option.kind && option.id)

// Strings become plain options; distinct by case-insensitive label, trimmed; an option with an identity beats one without, and
// the first of two with an identity wins (so list own teams before league teams). Order is otherwise kept.
export function normaliseOptions(options: Array<string | ImportColumnOption> | undefined): ImportColumnOption[] {
  const byLabel = new Map<string, ImportColumnOption>()
  for (const raw of options ?? []) {
    const option = typeof raw === 'string' ? { label: raw } : raw
    const label = option.label.trim()
    if (!label) continue
    const existing = byLabel.get(label.toLowerCase())
    if (!existing || (!hasIdentity(existing) && hasIdentity(option))) byLabel.set(label.toLowerCase(), { ...option, label })
  }
  return [...byLabel.values()]
}

export function pickOf(option: ImportColumnOption | null | undefined): ImportOptionPick | null {
  return option && option.kind && option.id ? { name: option.label, kind: option.kind, id: option.id } : null
}

// The picks become LINK resolutions keyed by the name as shown, replacing any earlier resolution of that name.
export function withPickedResolutions(decisions: ImportDecisions, picks: ImportOptionPick[] = []): ImportDecisions {
  let next = decisions
  for (const pick of picks) next = withResolution(next, { key: pick.name, kind: 'LINK', targetKind: pick.kind, targetId: pick.id, targetName: pick.name, remember: false })
  return next
}

// Whether any proposal of this step still needs a decision.
export function hasOpenProposals(batch: Pick<ImportBatch, 'proposals'> | null, step: ReferenceProposal['step'], decisions: ImportDecisions, notOurs: string[]): boolean {
  return (batch?.proposals ?? []).some((proposal) => proposal.step === step && !isProposalResolved(proposal, decisions, notOurs))
}

// Review's quiet line: names linked to an existing team are matched; a new team (created, or copied in from another season) is new.
export function teamSummary(proposals: ReferenceProposal[], decisions: ImportDecisions): { matched: number; created: number } {
  let matched = 0
  let created = 0
  for (const proposal of proposals) {
    if (proposal.step !== 'RESOLVE') continue
    const resolution = resolutionFor(decisions, proposal.key)
    if (!resolution) continue
    if (resolution.kind === 'CREATE' || (resolution.kind === 'LINK' && resolution.targetKind === TARGET_KIND_COPY_LEAGUE_TEAM)) created += 1
    else if (resolution.kind === 'LINK') matched += 1
  }
  return { matched, created }
}
