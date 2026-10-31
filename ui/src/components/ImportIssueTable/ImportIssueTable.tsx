import { useEffect, useRef, useState } from 'react'
import { importRowLabel } from '../../utils/importRowLabel'
import type { ReactNode } from 'react'
import { Alert, Box, ButtonBase, Chip, CircularProgress, Pagination, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AddIcon from '@mui/icons-material/Add'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { IMPORT_ROWS_PAGE_SIZE, importCount, useImportRows } from '../../api/importApi'
import type { ImportBatch, ImportDecisions, ImportEditableColumn, ImportIssue, ImportOutcome, ImportRow, ImportRowStatus, ReferenceCandidate, ReferenceProposal } from '../../api/importApi'
import { zebraTint } from '../../utils/zebraTint'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { PageCounters } from '../PageCounters'
import { isAddedRowNumber, pendingResolutionRows, pickOf, resolutionFor } from '../../utils/importDecisions'
import { ImportPendingChip, ImportRowChip } from './ImportChips'
import { editKeyHandler } from './editKeyHandler'
import { EditActions, NewRowForm, RowEditFields } from './ImportRowEdit'
import { playsItself } from './sameSides'
import type { ImportColumnOption, ImportColumnOptions, ImportOptionPick } from '../../utils/importDecisions'
import type { ImportEditLayout } from './ImportRowEdit'

// How a row's values are shown: one entry per column of the consumer's table (and one line of its phone card).
export interface ImportColumn {
  id: string
  header: string
  // Defaults to the row's value under `id`.
  render?: (row: ImportRow) => ReactNode
}

export interface ImportIssueTableProps {
  clubId: string
  batch: ImportBatch
  decisions: ImportDecisions
  columns?: ImportColumn[]
  onToggleExclude: (rowNumber: number) => void
  // A differing row may be updated (opt-in); omitted, no Update action is offered.
  onToggleUpdate?: (rowNumber: number) => void
  disabled?: boolean
  // Issue codes a later step clears (for example a team that is matched next): their rows show a neutral pending chip instead of
  // the Error chip and are not counted as errors.
  deferredCodes?: string[]
  // The pending chip's words.
  pendingLabel?: string
  // The reason of a pending row, built here (the server's wording reads as a failure): with an exact match proposed, and without one.
  pendingLinkedLabel?: (name: string, source: string) => string
  pendingUnmatchedLabel?: string
  // The reason of a pending row whose names are all to be created as new teams.
  pendingCreatedLabel?: string
  // Words a candidate's source (the resolver's badge); omitted, "your team".
  candidateBadge?: (candidate: ReferenceCandidate) => string | null
  // Spec 125: the columns a manager may type into (the type's editableColumns, only when it is editable). With these and the four
  // handlers below, rows get Edit, Add row and Remove. One call per Save press, only the changed keys.
  editableColumns?: ImportEditableColumn[]
  onEditRow?: (rowNumber: number, values: Record<string, string>, picks?: ImportOptionPick[]) => void
  onAddRow?: (values: Record<string, string>, picks?: ImportOptionPick[]) => void
  onRemoveRow?: (rowNumber: number) => void
  onResetRow?: (rowNumber: number) => void
  // The consumer's own control, on the same line as the Problems only switch (its own row on a phone).
  toolbarExtra?: ReactNode
  // Shown when the batch has no rows at all.
  emptyLabel?: string
  // Type-ahead suggestions for editable columns (key = column key), from the consumer; typing a value not listed is still accepted.
  columnOptions?: ImportColumnOptions
  // How the inputs of an edited row are grouped and ordered (for example notes behind an Add note button); omitted, declared order.
  editLayout?: ImportEditLayout
}

interface EditingProps {
  columnOptions?: ImportColumnOptions
  editLayout?: ImportEditLayout
  editableColumns?: ImportEditableColumn[]
  onEditRow?: (rowNumber: number, values: Record<string, string>, picks?: ImportOptionPick[]) => void
  onAddRow?: (values: Record<string, string>, picks?: ImportOptionPick[]) => void
  onRemoveRow?: (rowNumber: number) => void
  onResetRow?: (rowNumber: number) => void
  emptyLabel: string
}

const DEFAULT_PENDING_LABEL = 'Resolved in the team step'
const DEFAULT_LINKED_LABEL = (name: string, source: string) => `Matched: ${name} (${source})`
const DEFAULT_UNMATCHED_LABEL = 'Pick a match.'
const DEFAULT_CREATED_LABEL = 'To be added as new.'
const DEFAULT_EMPTY_LABEL = 'No rows yet. Add the first row.'

// A row typed in the wizard is shown as "New 1", "New 2" (its number is 1001 and up).
const rowLabelOf = (rowNumber: number) => (isAddedRowNumber(rowNumber) ? `New ${rowNumber - 1000}` : String(rowNumber))

type CounterFilter = 'WARNING' | 'ERROR' | null

const ALL_LIVE: ImportRowStatus[] = ['OK', 'WARNING', 'ERROR']
const PROBLEMS: ImportRowStatus[] = ['ERROR', 'WARNING']

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

// Columns for a consumer that gave none: the keys of the row values, in the order the server sent them.
function defaultColumns(rows: ImportRow[]): ImportColumn[] {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row.values)))]
  return keys.map((key) => ({ id: key, header: key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()) }))
}

interface PendingWording {
  proposals: ReferenceProposal[]
  decisions: ImportDecisions
  candidateBadge?: (candidate: ReferenceCandidate) => string | null
  linked: (name: string, source: string) => string
  unmatched: string
  created: string
}

// One plain sentence for a row that waits for the team step: where its names will link (an exact or remembered match, or the
// manager's own link), or that the manager chooses. Once per row, whatever the number of sides.
function pendingText(row: ImportRow, wording: PendingWording): string {
  const proposals = wording.proposals.filter((proposal) => proposal.step === 'RESOLVE' && proposal.rowNumbers.includes(row.rowNumber))
  const links: Array<{ name: string; source: string }> = []
  let created = false
  for (const proposal of proposals) {
    // Only a settled name counts as matched: an exact match waiting to be seeded still reads "pick".
    const resolution = resolutionFor(wording.decisions, proposal.key)
    if (!resolution) return wording.unmatched
    if (resolution.kind === 'CREATE') {
      created = true
      continue
    }
    if (resolution.kind !== 'LINK') continue
    const chosen = proposal.candidates.find((candidate) => candidate.targetId === resolution.targetId) ?? null
    const name = chosen?.targetName ?? resolution.targetName
    if (!name) return wording.unmatched
    const link = { name, source: (chosen && wording.candidateBadge ? wording.candidateBadge(chosen) : null) ?? 'your team' }
    if (!links.some((existing) => existing.name === link.name)) links.push(link)
  }
  if (links.length === 0) return created ? wording.created : wording.unmatched
  const sources = [...new Set(links.map((link) => link.source))]
  return wording.linked(links.map((link) => link.name).join(' and '), sources.length === 1 ? sources[0] : 'your teams')
}

function reasonFor(row: ImportRow, issues: ImportIssue[], excluded: boolean, pending: PendingWording | null = null): { text: string; tone: 'error' | 'warning' | 'muted'; title?: string } {
  if (excluded) return { text: 'Excluded. This row will not be imported.', tone: 'muted' }
  const own = issues.filter((issue) => issue.rowNumbers.includes(row.rowNumber) || (issue.rowNumbers.length === 0 && row.issueCodes.includes(issue.code)))
  if (own.length > 0) {
    if (pending) return { text: pendingText(row, pending), tone: 'muted', title: [...new Set(own.map((issue) => (issue.hint ? `${issue.message} ${issue.hint}` : issue.message)))].join(' ') }
    const worst = own.some((issue) => issue.severity === 'ERROR') ? 'error' : 'warning'
    return { text: own.map((issue) => (issue.hint ? `${issue.message} ${issue.hint}` : issue.message)).join(' '), tone: worst }
  }
  if (row.status === 'SKIPPED_NOT_OURS') return { text: 'Does not involve your teams. Not imported.', tone: 'muted' }
  if (row.outcome === 'DUPLICATE') return { text: 'Already exists. Skipped.', tone: 'muted' }
  if (row.outcome === 'DIFFERS') return { text: 'Exists with different details. Skipped unless you choose Update.', tone: 'muted' }
  return { text: '', tone: 'muted' }
}

const toneColor = { error: 'error.main', warning: 'warning.dark', muted: 'text.secondary' } as const

interface RowViewProps extends EditingProps {
  clubId: string
  batch: ImportBatch
  decisions: ImportDecisions
  columns?: ImportColumn[]
  status?: ImportRowStatus[]
  outcome?: ImportOutcome[]
  // Rows of this list can be excluded or updated.
  editable: boolean
  onToggleExclude: (rowNumber: number) => void
  onToggleUpdate?: (rowNumber: number) => void
  disabled: boolean
  pendingRows: Set<number>
  pendingLabel: string
  wording: Omit<PendingWording, 'proposals' | 'decisions'>
  testId: string
}

// One page of rows (50) from the rows endpoint, filtered by the server; the table on a desktop, stacked cards below md.
function RowsView({ clubId, batch, decisions, columns, status, outcome, editable, onToggleExclude, onToggleUpdate, disabled, pendingRows, pendingLabel, wording, testId, editableColumns = [], onEditRow, onAddRow, onRemoveRow, onResetRow, emptyLabel, columnOptions, editLayout }: RowViewProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true })
  const [page, setPage] = useState(0)
  const filters = { status, outcome, page, size: IMPORT_ROWS_PAGE_SIZE }
  const rowsQuery = useImportRows(clubId, batch.id, batch.revision, filters)
  const issues = batch.issues ?? []
  const canEdit = editable && editableColumns.length > 0 && onEditRow !== undefined && onAddRow !== undefined
  const [editing, setEditing] = useState<{ rowNumber: number; initial: Record<string, string>; values: Record<string, string> } | null>(null)
  const [draft, setDraft] = useState<{ position: 'top' | 'bottom'; values: Record<string, string> } | null>(null)
  // The type-ahead options chosen from the list in the open editor, by column key (spec 125 amendment: choosing settles the name).
  const [picked, setPicked] = useState<Record<string, ImportColumnOption>>({})
  const onPick = (key: string, option: ImportColumnOption | null) =>
    setPicked((current) => {
      const { [key]: _dropped, ...rest } = current
      return option ? { ...rest, [key]: option } : rest
    })
  // The picks still matching what the inputs hold now; one per name.
  const picksFor = (values: Record<string, string>): ImportOptionPick[] => {
    const byName = new Map<string, ImportOptionPick>()
    for (const [key, option] of Object.entries(picked)) {
      const pick = pickOf(option)
      if (pick && (values[key] ?? '').trim() === pick.name) byName.set(pick.name, pick)
    }
    return [...byName.values()]
  }
  const rootRef = useRef<HTMLDivElement>(null)
  const focusKey = useRef<string | null>(null)

  // Focus goes back to the control that opened the editor (the row's Edit button, or the Add row button) once it is on screen.
  useEffect(() => {
    if (editing !== null || draft !== null || focusKey.current === null) return
    const target = rootRef.current?.querySelector<HTMLElement>(`[data-focus-key="${focusKey.current}"]`)
    if (target) {
      target.focus()
      focusKey.current = null
    }
  })

  if (rowsQuery.isPending) return <CircularProgress size={22} aria-label="Loading rows" sx={{ alignSelf: 'center', m: 2 }} />
  if (rowsQuery.isError) {
    return (
      <Alert severity="error" action={<Button size="compact" variant="ghost" onClick={() => void rowsQuery.refetch()}>Try Again</Button>}>
        We could not load the rows.
      </Alert>
    )
  }
  const { content, totalElements, totalPages } = rowsQuery.data
  const cols = columns ?? defaultColumns(content)
  const from = totalElements === 0 ? 0 : page * IMPORT_ROWS_PAGE_SIZE + 1
  const to = page * IMPORT_ROWS_PAGE_SIZE + content.length

  const actions = (row: ImportRow) => {
    if (!editable || row.status === 'SKIPPED_NOT_OURS') return null
    const excluded = decisions.excludedRows.includes(row.rowNumber)
    const updating = decisions.updates.some((update) => update.rowNumber === row.rowNumber)
    const added = isAddedRowNumber(row.rowNumber)
    if (editing?.rowNumber === row.rowNumber) {
      return <EditActions onSave={() => saveEdit(row)} onCancel={() => cancelEdit(row.rowNumber)} onReset={row.origin === 'EDITED' && onResetRow ? () => resetEdit(row.rowNumber) : undefined} disabled={disabled || playsItself(editing.values, editLayout)} />
    }
    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {canEdit && !excluded && (
          <Button size="compact" variant="ghost" disabled={disabled} aria-label={`Edit row ${rowLabelOf(row.rowNumber)}`} data-focus-key={`edit-${row.rowNumber}`} onClick={() => startEdit(row)} sx={{ minHeight: { xs: 44, md: 32 } }}>
            Edit
          </Button>
        )}
        {added && onRemoveRow && (
          <Button size="compact" variant="ghost" disabled={disabled} aria-label={`Remove row ${rowLabelOf(row.rowNumber)}`} onClick={() => onRemoveRow(row.rowNumber)} sx={{ minHeight: { xs: 44, md: 32 } }}>
            Remove
          </Button>
        )}
        {row.outcome === 'DIFFERS' && onToggleUpdate && !excluded && (
          <Button size="compact" variant="ghost" disabled={disabled} aria-pressed={updating} onClick={() => onToggleUpdate(row.rowNumber)} sx={{ minHeight: { xs: 44, md: 32 } }}>
            {updating ? 'Keep as is' : 'Update'}
          </Button>
        )}
        {!added && (
          <Button size="compact" variant="ghost" disabled={disabled} aria-label={`${excluded ? 'Include' : 'Exclude'} row ${row.rowNumber}`} onClick={() => onToggleExclude(row.rowNumber)} sx={{ minHeight: { xs: 44, md: 32 } }}>
            {excluded ? 'Include' : 'Exclude'}
          </Button>
        )}
      </Box>
    )
  }

  const startEdit = (row: ImportRow) => {
    const initial: Record<string, string> = {}
    for (const column of editableColumns) {
      const value = row.values[column.key]
      initial[column.key] = value === null || value === undefined ? '' : String(value)
    }
    setDraft(null)
    setPicked({})
    setEditing({ rowNumber: row.rowNumber, initial, values: { ...initial } })
  }
  const cancelEdit = (rowNumber: number) => {
    focusKey.current = `edit-${rowNumber}`
    setEditing(null)
  }
  // One call, only the keys whose text changed; nothing changed is a cancel.
  const saveEdit = (row: ImportRow) => {
    if (!editing || !onEditRow || playsItself(editing.values, editLayout)) return
    const changed: Record<string, string> = {}
    for (const column of editableColumns) if (editing.values[column.key] !== editing.initial[column.key]) changed[column.key] = editing.values[column.key]
    const picks = picksFor(editing.values)
    focusKey.current = `edit-${row.rowNumber}`
    setEditing(null)
    setPicked({})
    // A name chosen from the list is recorded even when the text is unchanged; an edit with neither is a cancel.
    if (Object.keys(changed).length > 0 || picks.length > 0) {
      if (picks.length > 0) onEditRow(row.rowNumber, changed, picks)
      else onEditRow(row.rowNumber, changed)
    }
  }
  const resetEdit = (rowNumber: number) => {
    focusKey.current = `edit-${rowNumber}`
    setEditing(null)
    onResetRow?.(rowNumber)
  }
  // The new row starts with the date and venue of the nearest row above it that has one (the last listed), to be overwritten.
  const startDraft = (position: 'top' | 'bottom') => {
    const listed = [...content].reverse().filter((row) => row.status !== 'SKIPPED_NOT_OURS')
    const values: Record<string, string> = {}
    for (const key of ['date', 'venue']) {
      const copied = listed.map((row) => row.values[key]).find((value) => value !== null && value !== undefined && value !== '')
      if (editableColumns.some((column) => column.key === key) && copied !== undefined) values[key] = String(copied)
    }
    setEditing(null)
    setPicked({})
    setDraft({ position, values })
  }
  const cancelDraft = () => {
    focusKey.current = `add-${draft?.position ?? 'top'}`
    setDraft(null)
  }
  const saveDraft = () => {
    if (!draft || !onAddRow || playsItself(draft.values, editLayout)) return
    const typed = Object.fromEntries(Object.entries(draft.values).filter(([, value]) => value.trim() !== ''))
    const picks = picksFor(draft.values)
    focusKey.current = `add-${draft.position}`
    setDraft(null)
    setPicked({})
    if (Object.keys(typed).length > 0) {
      if (picks.length > 0) onAddRow(typed, picks)
      else onAddRow(typed)
    }
  }
  const isEditing = (row: ImportRow) => editing?.rowNumber === row.rowNumber
  const editableKeys = new Set(editableColumns.map((column) => column.key))
  const editFields = (row: ImportRow) =>
    editing ? (
      <RowEditFields
        columns={editableColumns}
        values={editing.values}
        onChange={(key, next) => setEditing((current) => (current ? { ...current, values: { ...current.values, [key]: next } } : current))}
        rowLabel={rowLabelOf(row.rowNumber)}
        columnOptions={columnOptions}
        layout={editLayout}
        onPick={onPick}
        picked={picked}
      />
    ) : null

  // A cell: the input while its row is edited, otherwise the value with "was: ..." under a value changed from the file.
  const cell = (row: ImportRow, column: ImportColumn): ReactNode => {
    const was = row.fileValues?.[column.id]
    return (
      <>
        {column.render ? column.render(row) : show(row.values[column.id])}
        {row.origin === 'EDITED' && editableKeys.has(column.id) && was !== undefined && (
          <Typography component="div" variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>was: {show(was)}</Typography>
        )}
      </>
    )
  }
  const originChip = (row: ImportRow) =>
    row.origin === 'EDITED' || row.origin === 'ADDED' ? <Chip size="small" variant="outlined" color="info" label={row.origin === 'EDITED' ? 'Edited' : 'Added'} sx={{ fontWeight: 600, flex: 'none', mt: 0.5 }} /> : null
  const addButton = (position: 'top' | 'bottom') =>
    canEdit && (
      <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-start' } }}>
        <Button size="compact" variant="secondary" startIcon={<AddIcon />} disabled={disabled || draft !== null} data-focus-key={`add-${position}`} onClick={() => startDraft(position)} sx={{ minHeight: { xs: 44, md: 32 }, flex: { xs: 1, sm: 'none' } }}>
          Add row
        </Button>
      </Box>
    )
  const draftForm = (position: 'top' | 'bottom') =>
    draft?.position === position ? (
      <NewRowForm columns={editableColumns} columnOptions={columnOptions} onPick={onPick} picked={picked} layout={editLayout} values={draft.values} onChange={(key, value) => setDraft((current) => (current ? { ...current, values: { ...current.values, [key]: value } } : current))} onSave={saveDraft} onCancel={cancelDraft} disabled={disabled} />
    ) : null
  const rowKeys = (row: ImportRow) => (isEditing(row) ? { onKeyDown: editKeyHandler(() => saveEdit(row), () => cancelEdit(row.rowNumber)) } : {})

  let body: ReactNode
  const noRowsAtAll = canEdit && totalElements === 0 && importCount(batch, 'rows') === 0
  if (content.length === 0) {
    body = <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>{noRowsAtAll ? emptyLabel : 'No rows match this view.'}</Typography>
  } else if (phone) {
    body = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {content.map((row) => {
          const excluded = decisions.excludedRows.includes(row.rowNumber)
          const pending = pendingRows.has(row.rowNumber) && row.status === 'ERROR'
          const reason = reasonFor(row, issues, excluded, pending ? { ...wording, proposals: batch.proposals ?? [], decisions } : null)
          const accent = pending ? 'text.disabled' : row.status === 'ERROR' ? 'error.main' : row.status === 'WARNING' || row.outcome === 'POSSIBLE_DUPLICATE' ? 'warning.main' : row.status === 'SKIPPED_NOT_OURS' ? 'text.disabled' : 'success.main'
          return (
            <Box key={row.rowNumber} data-testid={`import-row-${row.rowNumber}`} {...rowKeys(row)} sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderLeft: 4, borderLeftColor: accent, borderRadius: 1, p: 1.25, opacity: excluded ? 0.7 : 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" fontWeight={700}>{importRowLabel(row.rowNumber)}</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {originChip(row)}
                  {pending && !excluded ? <ImportPendingChip label={pendingLabel} /> : <ImportRowChip row={row} />}
                </Box>
              </Box>
              {isEditing(row) ? (
                <Box sx={{ mt: 1 }}>{editFields(row)}</Box>
              ) : (
              <Box component="dl" sx={{ m: 0, mt: 0.5, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, rowGap: 0.25 }}>
                {cols.map((column) => (
                  <Box key={column.id} sx={{ display: 'contents' }}>
                    <Typography component="dt" variant="caption" color="text.secondary" sx={{ display: 'block' }}>{column.header}</Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>{cell(row, column)}</Typography>
                  </Box>
                ))}
              </Box>
              )}
              {reason.text && <Typography variant="body2" title={reason.title} sx={{ mt: 0.75, color: toneColor[reason.tone] }}>{reason.text}</Typography>}
              {actions(row)}
            </Box>
          )
        })}
      </Box>
    )
  } else {
    body = (
      <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
        <Table size="small" aria-label="Import rows">
          <TableHead>
            <TableRow>
              {['Row', 'Status', ...cols.map((column) => column.header), 'Reason', ''].map((header, index) => (
                <TableCell key={`${header}-${index}`} sx={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {content.map((row, index) => {
              const excluded = decisions.excludedRows.includes(row.rowNumber)
              const pending = pendingRows.has(row.rowNumber) && row.status === 'ERROR'
              const reason = reasonFor(row, issues, excluded, pending ? { ...wording, proposals: batch.proposals ?? [], decisions } : null)
              return (
                <TableRow key={row.rowNumber} data-testid={`import-row-${row.rowNumber}`} {...rowKeys(row)} sx={(t) => ({ verticalAlign: 'top', opacity: excluded ? 0.7 : 1, bgcolor: index % 2 === 1 ? zebraTint(t) : undefined })}>
                  <TableCell>{rowLabelOf(row.rowNumber)}</TableCell>
                  <TableCell>
                    {pending && !excluded ? <ImportPendingChip label={pendingLabel} /> : <ImportRowChip row={row} />}
                    <Box>{originChip(row)}</Box>
                  </TableCell>
                  {isEditing(row) ? (
                    <TableCell colSpan={cols.length}>{editFields(row)}</TableCell>
                  ) : (
                    cols.map((column) => <TableCell key={column.id}>{cell(row, column)}</TableCell>)
                  )}
                  <TableCell title={reason.title} sx={{ color: toneColor[reason.tone], minWidth: 180 }}>{reason.text}</TableCell>
                  <TableCell align="right">{actions(row)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    )
  }

  return (
    <Box ref={rootRef} data-testid={testId} sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      {addButton('top')}
      {draftForm('top')}
      {body}
      {draftForm('bottom')}
      {content.length > 0 && addButton('bottom')}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" role="status">
          Showing {from} to {to} of {totalElements} rows
        </Typography>
        {totalPages > 1 && (
          <Pagination count={totalPages} page={page + 1} size="small" onChange={(_event, next) => setPage(next - 1)} disabled={rowsQuery.isFetching} />
        )}
      </Box>
    </Box>
  )
}

// docs/specs/097-import-framework.md, Validate step ("Check rows"): counters that double as filters (Warnings, Errors), a
// Problems only switch, the rows (a zebra table, cards on a phone) and an expandable "Skipped, not ours (N)" section. Rows come
// only from the paginated rows endpoint, 50 per page, filtered by the server (status, outcome); nothing is sliced here.
export function ImportIssueTable({ clubId, batch, decisions, columns, onToggleExclude, onToggleUpdate, disabled = false, deferredCodes = [], pendingLabel = DEFAULT_PENDING_LABEL, pendingLinkedLabel = DEFAULT_LINKED_LABEL, pendingUnmatchedLabel = DEFAULT_UNMATCHED_LABEL, pendingCreatedLabel = DEFAULT_CREATED_LABEL, candidateBadge, editableColumns, onEditRow, onAddRow, onRemoveRow, onResetRow, emptyLabel = DEFAULT_EMPTY_LABEL, columnOptions, editLayout, toolbarExtra }: ImportIssueTableProps) {
  const [counterFilter, setCounterFilter] = useState<CounterFilter>(null)
  const [problemsOnly, setProblemsOnly] = useState(false)
  const [skippedOpen, setSkippedOpen] = useState(false)
  const skipped = importCount(batch, 'skippedNotOurs')
  const warnings = importCount(batch, 'warnings')
  const pendingRows = pendingResolutionRows(batch.issues ?? [], deferredCodes)
  const errors = Math.max(0, importCount(batch, 'errors') - pendingRows.size)

  const wording = { linked: pendingLinkedLabel, unmatched: pendingUnmatchedLabel, created: pendingCreatedLabel, candidateBadge }
  const status: ImportRowStatus[] = counterFilter ? [counterFilter] : problemsOnly ? PROBLEMS : ALL_LIVE
  const select = (filter: Exclude<CounterFilter, null>) => setCounterFilter((current) => (current === filter ? null : filter))
  const viewKey = status.join(',')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
      <PageCounters
        items={[
          { id: 'rows', value: importCount(batch, 'rows'), label: 'Rows' },
          { id: 'ok', value: importCount(batch, 'ok'), label: 'OK' },
          { id: 'warnings', value: warnings, label: 'Warnings', tone: warnings > 0 ? 'warning' : 'default', kind: 'filter', hint: 'Show only warnings', active: counterFilter === 'WARNING', onSelect: () => select('WARNING') },
          { id: 'errors', value: errors, label: 'Errors', tone: errors > 0 ? 'warning' : 'default', kind: 'filter', hint: 'Show only errors', active: counterFilter === 'ERROR', onSelect: () => select('ERROR') },
          ...(skipped > 0 ? [{ id: 'skipped', value: skipped, label: 'Skipped, not ours', shortLabel: 'Not ours' }] : []),
        ]}
      />
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between', gap: 1 }}>
        <CompactSwitch checked={problemsOnly} onChange={setProblemsOnly} label="Problems only" disabled={counterFilter !== null} />
        {toolbarExtra && <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>{toolbarExtra}</Box>}
      </Box>
      <RowsView
        key={viewKey}
        clubId={clubId}
        batch={batch}
        decisions={decisions}
        columns={columns}
        status={status}
        editable
        onToggleExclude={onToggleExclude}
        onToggleUpdate={onToggleUpdate}
        disabled={disabled}
        pendingRows={pendingRows}
        pendingLabel={pendingLabel}
        wording={wording}
        testId="import-rows"
        editableColumns={editableColumns}
        onEditRow={onEditRow}
        onAddRow={onAddRow}
        onRemoveRow={onRemoveRow}
        onResetRow={onResetRow}
        emptyLabel={emptyLabel}
        columnOptions={columnOptions}
        editLayout={editLayout}
      />
      {skipped > 0 && (
        <Box sx={{ border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
          <ButtonBase
            onClick={() => setSkippedOpen((current) => !current)}
            aria-expanded={skippedOpen}
            aria-controls="import-skipped-rows"
            sx={{ width: '100%', minHeight: 44, px: 1.5, justifyContent: 'flex-start', gap: 0.75, textAlign: 'left' }}
          >
            {skippedOpen ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            <Typography component="span" variant="body2" fontWeight={700}>Skipped, not ours ({skipped})</Typography>
            <Typography component="span" variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Rows with none of your records. Not imported.
            </Typography>
          </ButtonBase>
          {skippedOpen && (
            <Box id="import-skipped-rows" sx={{ p: 1.5, pt: 0 }}>
              <RowsView clubId={clubId} batch={batch} decisions={decisions} columns={columns} outcome={['SKIPPED_NOT_OURS']} editable={false} onToggleExclude={onToggleExclude} disabled={disabled} pendingRows={new Set()} pendingLabel={pendingLabel} wording={wording} testId="import-skipped-rows-list" emptyLabel={emptyLabel} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
