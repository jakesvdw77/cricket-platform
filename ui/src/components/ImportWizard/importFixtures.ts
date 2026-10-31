import { emptyImportDecisions } from '../../api/importApi'
import type { DeletionCheck, ImportBatch, ImportEditableColumn, ImportIssue, ImportRow, ImportType, PlannedChange, ReferenceProposal } from '../../api/importApi'

// docs/specs/097-import-framework.md: sample data for the import components' stories and tests. A league schedule is the sample
// (the first consumer is spec 098) but nothing here is read by the framework: the components only know the generic shapes.

export const SAMPLE_CLUB_ID = 'club-1'
export const SAMPLE_BATCH_ID = 'batch-1'

export const SAMPLE_TYPE: ImportType = {
  type: 'SAMPLE_SCHEDULE',
  label: 'Sample schedule',
  templateVersion: 1,
  formats: ['xlsx', 'csv'],
  supportsOursScope: true,
  limits: { maxFileBytes: 2 * 1024 * 1024, maxRows: 1000, maxCellCharacters: 1000, maxOpenPreviewsPerUser: 5, maxOpenPreviewsPerClub: 20, maxPreviewsPerClubPerHour: 30 },
}

export const SAMPLE_EDITABLE_COLUMNS: ImportEditableColumn[] = [
  { key: 'date', label: 'Date', kind: 'DATE' },
  { key: 'home', label: 'Home team', kind: 'TEXT' },
  { key: 'away', label: 'Away team', kind: 'TEXT' },
  { key: 'venue', label: 'Venue', kind: 'TEXT' },
  { key: 'time', label: 'Time', kind: 'TIME' },
  { key: 'notes', label: 'Notes', kind: 'TEXT' },
]

// The sample type with editable rows (spec 125).
export const SAMPLE_EDITABLE_TYPE: ImportType = { ...SAMPLE_TYPE, editable: true, editableColumns: SAMPLE_EDITABLE_COLUMNS }

function row(rowNumber: number, home: string, away: string, patch: Partial<ImportRow> = {}): ImportRow {
  return { rowNumber, sourceRef: `A${rowNumber}`, values: { date: '2026-10-04', home, away, time: '09:00' }, status: 'OK', outcome: 'NEW', action: 'CREATE', issueCodes: [], existingRef: null, ...patch }
}

export const SAMPLE_ROWS: ImportRow[] = [
  row(14, 'POLICE 1', 'POLICE 1', { status: 'ERROR', outcome: null, action: 'SKIP', issueCodes: ['SAME_TEAM'] }),
  row(22, 'PHSOB', 'CBCOB', { status: 'ERROR', outcome: null, action: 'SKIP', issueCodes: ['BAD_DATE'], values: { date: '31 Feb 2026', home: 'PHSOB', away: 'CBCOB', time: '13:30' } }),
  row(31, 'VETS', 'OLD BOYS', { status: 'WARNING', issueCodes: ['OUTSIDE_LEAGUE_DATES'] }),
  row(37, 'CBC U13', 'HILTON', { status: 'WARNING', outcome: 'POSSIBLE_DUPLICATE', issueCodes: ['POSSIBLE_DUPLICATE'] }),
  row(41, 'CBC U13', 'MARITZ', { outcome: 'DIFFERS', action: 'SKIP', values: { date: '2026-10-11', home: 'CBC U13', away: 'MARITZ', time: '10:00' } }),
  row(43, 'CBC U13', 'GLENWOOD', { outcome: 'DUPLICATE', action: 'SKIP' }),
  row(44, 'CBC U15', 'GLENWOOD'),
  row(51, 'CBC U13', 'MARITZ'),
  row(60, 'HILTON', 'MARITZ', { status: 'SKIPPED_NOT_OURS', outcome: 'SKIPPED_NOT_OURS', action: 'SKIP' }),
  row(61, 'GLENWOOD', 'MARITZ', { status: 'SKIPPED_NOT_OURS', outcome: 'SKIPPED_NOT_OURS', action: 'SKIP' }),
]

export const SAMPLE_ISSUES: ImportIssue[] = [
  { code: 'SAME_TEAM', severity: 'ERROR', rowNumbers: [14], field: 'away', message: 'Home and away are the same team.', hint: null },
  { code: 'BAD_DATE', severity: 'ERROR', rowNumbers: [22], field: 'date', message: '31 Feb is not a date (cell C22).', hint: null },
  { code: 'OUTSIDE_LEAGUE_DATES', severity: 'WARNING', rowNumbers: [31], field: 'date', message: 'Outside the league dates (starts 1 Oct).', hint: null },
  { code: 'POSSIBLE_DUPLICATE', severity: 'WARNING', rowNumbers: [37], field: null, message: 'Close to an existing match on 04 Oct at 09:30.', hint: null },
]

export const SAMPLE_PROPOSALS: ReferenceProposal[] = [
  {
    key: 'CBCOB',
    value: 'CBCOB',
    step: 'IDENTIFY_OURS',
    rowNumbers: [22, 44, 51],
    candidates: [{ targetKind: 'TEAM', targetId: 't-1', targetName: 'Collegians Old Boys', origin: 'remembered from an earlier import', confidence: 100, reasons: ['remembered from an earlier import'], preselected: true }],
  },
  {
    key: 'OLD BOYS',
    value: 'OLD BOYS',
    step: 'IDENTIFY_OURS',
    rowNumbers: [31],
    candidates: [{ targetKind: 'TEAM', targetId: 't-2', targetName: 'Old Boys XI', origin: 'our teams', confidence: 74, reasons: ['token similarity'], preselected: false }],
  },
  {
    key: 'VETERANS',
    value: 'VETERANS',
    step: 'RESOLVE',
    rowNumbers: [31, 32, 33, 34],
    candidates: [
      { targetKind: 'LEAGUE_TEAM', targetId: 'lt-2', targetName: 'Veterans XI', origin: 'Southern Cup, 2026/27', confidence: 61, reasons: ['token similarity', 'other league of the club'], preselected: false },
      { targetKind: 'LEAGUE_TEAM', targetId: 'lt-1', targetName: 'Vets', origin: 'this league, 2025/26', confidence: 92, reasons: ['VETERANS = VETS', 'same league last season'], preselected: false },
    ],
  },
  { key: 'Zebras', value: 'Zebras', step: 'RESOLVE', rowNumbers: [70, 71], candidates: [] },
]

// A schedule-flavoured set (spec 098): own teams, a team copied from an earlier season, one from another league, a sister team shown
// as a hint only, a weak match, and a name with nothing similar (to create). Candidates carry the optional source fields.
export const SCHEDULE_PROPOSALS: ReferenceProposal[] = [
  {
    key: 'CBCOB',
    value: 'CBCOB',
    step: 'RESOLVE',
    rowNumbers: [3, 9, 15],
    candidates: [{ targetKind: 'OWN_TEAM', targetId: 't-1', targetName: 'Collegians Old Boys', origin: 'our teams', confidence: 100, reasons: ['remembered from an earlier import'], preselected: true, source: 'ALIAS' }],
  },
  {
    key: 'VETERANS',
    value: 'VETERANS',
    step: 'RESOLVE',
    rowNumbers: [4, 10],
    candidates: [
      { targetKind: 'COPY_LEAGUE_TEAM', targetId: 'lt-1', targetName: 'Vets', origin: null, confidence: 92, reasons: ['VETERANS = VETS'], preselected: false, source: 'LEAGUE_PREVIOUS_SEASON', seasonLabel: '2025/26', leagueName: 'Northern Premier League' },
      { targetKind: 'COPY_LEAGUE_TEAM', targetId: 'lt-2', targetName: 'Veterans XI', origin: null, confidence: 61, reasons: ['token similarity'], preselected: false, source: 'LEAGUE_OTHER', seasonLabel: '2026/27', leagueName: 'Southern Cup' },
    ],
  },
  {
    key: 'POLICE 2',
    value: 'POLICE 2',
    step: 'RESOLVE',
    rowNumbers: [6],
    candidates: [
      { targetKind: 'SISTER_TEAM', targetId: 'lt-5', targetName: 'Police 1', origin: null, confidence: 86, reasons: ['different team number'], preselected: false, source: 'LEAGUE_THIS_SEASON' },
      { targetKind: 'LEAGUE_TEAM', targetId: 'lt-6', targetName: 'Police', origin: null, confidence: 78, reasons: ['no team number in the sheet'], preselected: false, source: 'LEAGUE_THIS_SEASON' },
    ],
  },
  { key: 'PHSOB', value: 'PHSOB', step: 'RESOLVE', rowNumbers: [7, 8], candidates: [] },
]

export const SAMPLE_PLANNED: PlannedChange[] = [
  { action: 'CREATED', entityType: 'MATCH', label: 'CBC U15 v Glenwood, 11 Oct 09:00', rowNumber: 44, detail: {}, changes: {} },
  { action: 'CREATED', entityType: 'MATCH', label: 'CBC U13 v Maritz, 18 Oct 09:00', rowNumber: 51, detail: {}, changes: {} },
  { action: 'CREATED', entityType: 'LEAGUE_TEAM', label: 'Zebras', rowNumber: null, detail: {}, changes: {} },
  { action: 'UPDATED', entityType: 'MATCH', label: 'CBC U13 v Maritz, 11 Oct', rowNumber: 41, detail: {}, changes: { time: { from: '09:00', to: '10:00' } } },
]

export function sampleBatch(patch: Partial<ImportBatch> = {}): ImportBatch {
  return {
    id: SAMPLE_BATCH_ID,
    clubId: SAMPLE_CLUB_ID,
    type: SAMPLE_TYPE.type,
    templateVersion: 1,
    status: 'PREVIEW',
    scopeKey: 'league-1|season-1',
    scope: { scopeMode: 'OURS_ONLY', templateScope: 'OURS_AND_OTHERS', params: { leagueId: 'league-1', seasonId: 'season-1' } },
    scopeMode: 'OURS_ONLY',
    timeZone: 'Africa/Johannesburg',
    fileName: 'schedule-2026.xlsx',
    fileSizeBytes: 48_000,
    revision: 1,
    counts: { rows: 10, ok: 3, warnings: 2, errors: 2, created: 3, updated: 1, duplicates: 1, skippedNotOurs: 2, excluded: 0 },
    issues: SAMPLE_ISSUES,
    proposals: SAMPLE_PROPOSALS,
    plannedChanges: SAMPLE_PLANNED,
    fileWarnings: [],
    decisions: emptyImportDecisions(),
    earlierImportWarning: null,
    firstRows: SAMPLE_ROWS,
    confirmationToken: null,
    creationsDigest: null,
    lastError: null,
    createdBy: 'user-1',
    createdAt: '2026-10-28T08:00:00Z',
    expiresAt: '2026-10-29T08:00:00Z',
    committedBy: null,
    committedAt: null,
    deletedBy: null,
    deletedAt: null,
    ...patch,
  }
}

// A batch with nothing left to fix: Confirm is allowed once the token is present.
export function confirmableBatch(patch: Partial<ImportBatch> = {}): ImportBatch {
  return sampleBatch({
    issues: SAMPLE_ISSUES.filter((issue) => issue.severity === 'WARNING'),
    counts: { rows: 10, ok: 5, warnings: 2, errors: 0, created: 3, updated: 1, duplicates: 1, skippedNotOurs: 2, excluded: 2 },
    confirmationToken: 'token-1',
    creationsDigest: 'digest-1',
    revision: 4,
    ...patch,
  })
}

export function committedBatch(patch: Partial<ImportBatch> = {}): ImportBatch {
  return confirmableBatch({
    status: 'COMMITTED',
    confirmationToken: null,
    creationsDigest: null,
    committedAt: '2026-10-28T08:05:00Z',
    committedBy: 'user-1',
    counts: { rows: 10, ok: 5, warnings: 2, errors: 0, created: 3, updated: 1, duplicates: 1, skippedNotOurs: 2, excluded: 2, committedEntities: 4 },
    ...patch,
  })
}

export const DELETABLE: DeletionCheck = { deletable: true, blockers: [], willDelete: { Matches: 3, 'League teams': 1 }, willKeep: { 'Matches updated by this import': 1 } }

export const BLOCKED: DeletionCheck = {
  deletable: false,
  blockers: [{ entityType: 'MATCH', entityId: 'm-1', label: 'CBC U15 v Glenwood, 11 Oct', reasons: ['HAS_POLL'], detail: 'An availability poll uses this match.', link: '/manage/fixtures/matches/m-1' }],
  willDelete: {},
  willKeep: {},
}
