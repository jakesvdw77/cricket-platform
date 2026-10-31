import { Typography } from '@mui/material'
import type { ReactNode } from 'react'
import type { ImportScopeMode, ImportTemplateScope, PlannedChange, ReferenceCandidate, ReferenceCandidateSource, ReferenceProposal } from '../../../api/importApi'
import { TARGET_KIND_COPY_LEAGUE_TEAM } from '../../../api/importApi'
import { formatDateOfBirth } from '../../../utils/playerFormat'
import type { DescribedChange } from '../../../components/ImportConfirmPanel'

// docs/specs/098-league-schedule-import.md, "Team resolution": the wording of a team candidate, where it lives (the group the
// spec lists), what linking it does, and how the Review step words a planned change. Plain text, no layout of its own.

export const SOURCE_LABELS: Record<ReferenceCandidateSource, string> = {
  ALIAS: 'Remembered from an earlier import',
  OWN_AFFILIATED: 'Our team in this league',
  LEAGUE_THIS_SEASON: 'League team, this season',
  LEAGUE_PREVIOUS_SEASON: 'League team, earlier season',
  LEAGUE_OTHER: 'League team, another league',
  OWN_OTHER: 'Our team, not in this league',
}

export const SCOPE_MODE_LABELS: Record<ImportScopeMode, string> = { ALL: 'All matches in the file', OURS_ONLY: 'Only matches involving our teams' }

export const SCOPE_MODE_HELP: Record<ImportScopeMode, string> = {
  ALL: 'The whole league schedule: every team is checked and every match is imported.',
  OURS_ONLY:
    'Only your fixtures are imported. Other matches are listed and skipped, and only your opponents need linking. League schedule shares will show only your matches.',
}

export const TEMPLATE_SCOPE_LABELS: Record<ImportTemplateScope, string> = { OURS_ONLY: 'Our teams only', OURS_AND_OTHERS: 'Our teams and league teams' }

// The badge beside a candidate's name: where the team lives, in words.
export function scheduleCandidateBadge(candidate: ReferenceCandidate): string | null {
  return candidate.source ? SOURCE_LABELS[candidate.source] : null
}

// What the candidate card adds under a candidate: what choosing it does (its source is the badge beside the name).
export function renderScheduleCandidate(_proposal: ReferenceProposal, candidate: ReferenceCandidate): ReactNode {
  const lines: string[] = []
  if (candidate.targetKind === TARGET_KIND_COPY_LEAGUE_TEAM) {
    const from = [candidate.seasonLabel, candidate.leagueName].filter(Boolean)
    lines.push(from.length > 0 ? `Will be copied from ${from.join(', ')} into this league and season.` : 'Will be copied into this league and season.')
  } else if (candidate.targetKind === 'OWN_TEAM') {
    lines.push('Our team: matches with it get polls, selection and section access.')
    if (candidate.source === 'OWN_OTHER') lines.push('It is not entered in this league yet.')
  } else if (candidate.targetKind === 'LEAGUE_TEAM') {
    lines.push('League team: shown on the schedule only, with no polls or selection.')
  }
  if (lines.length === 0) return null
  return (
    <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </Typography>
  )
}

function show(value: unknown): string {
  if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
    const change = value as { from: unknown; to: unknown }
    return `${String(change.from ?? 'none')} to ${String(change.to ?? 'none')}`
  }
  return String(value ?? 'none')
}

function dateChange(value: unknown): { from: string | null; to: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const from = (record.old ?? record.from) as string | null | undefined
  const to = (record.new ?? record.to) as string | null | undefined
  return { from: from ?? null, to: to ?? null }
}

// "League dates: 1 Oct 2026 to 31 Mar 2027 becomes 1 Oct 2026 to 30 Apr 2027"; a side that did not change keeps its old date.
export function describeLeagueDatesChange(changes: Record<string, unknown>): string {
  const start = dateChange(changes.start)
  const end = dateChange(changes.end)
  const day = (value: string | null | undefined) => (value ? formatDateOfBirth(value) : 'no date')
  const before = `${day(start?.from ?? start?.to)} to ${day(end?.from ?? end?.to)}`
  const after = `${day(start?.to ?? start?.from)} to ${day(end?.to ?? end?.from)}`
  return `League dates: ${before} becomes ${after}`
}

export function describeScheduleChange(change: PlannedChange): DescribedChange {
  if (change.entityType === 'LEAGUE_TEAM') {
    const copiedFrom = typeof change.detail.copiedFrom === 'string' ? change.detail.copiedFrom : null
    const abbreviation = typeof change.detail.abbreviation === 'string' && change.detail.abbreviation ? change.detail.abbreviation : null
    const parts = [copiedFrom ? `Copied from ${copiedFrom}` : null, abbreviation ? `Abbreviation ${abbreviation}` : null].filter(Boolean)
    return { title: change.label, detail: parts.length > 0 ? parts.join('. ') : undefined }
  }
  if (change.entityType === 'LEAGUE_SEASON') return { title: describeLeagueDatesChange(change.changes) }
  const entries = Object.entries(change.changes)
  return { title: change.label, detail: entries.length > 0 ? entries.map(([key, value]) => `${key}: ${show(value)}`).join(', ') : undefined }
}

export function scheduleConfirmLabel(planned: PlannedChange[] | null): string {
  const created = (planned ?? []).filter((change) => change.action === 'CREATED')
  const teams = created.filter((change) => change.entityType === 'LEAGUE_TEAM').length
  const matches = created.filter((change) => change.entityType === 'MATCH').length
  const part = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  if (teams > 0 && matches > 0) return `Confirm and Create ${part(teams, 'Team', 'Teams')} and ${part(matches, 'Match', 'Matches')}`
  if (matches > 0) return `Confirm and Create ${part(matches, 'Match', 'Matches')}`
  if (teams > 0) return `Confirm and Create ${part(teams, 'Team', 'Teams')}`
  return 'Confirm and Import'
}
