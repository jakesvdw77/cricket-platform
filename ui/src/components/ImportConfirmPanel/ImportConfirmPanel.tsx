import { useState } from 'react'
import { importRowLabel, importRowLabels } from '../../utils/importRowLabel'
import type { ReactNode } from 'react'
import { Alert, Box, Checkbox, FormControlLabel, Typography } from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import { importCount } from '../../api/importApi'
import type { ImportBatch, ImportDecisions, PlannedChange } from '../../api/importApi'
import { warningGroups, withAcknowledgement } from '../../utils/importDecisions'
import { Button } from '../Button'
import { ImportOutcomeChip } from '../ImportIssueTable'
import { KeyFigureTile } from '../KeyFigureTile'
import { WizardFooter } from '../WizardFooter'

export interface DescribedChange {
  title: ReactNode
  detail?: ReactNode
}

export interface ImportConfirmPanelProps {
  batch: ImportBatch
  decisions: ImportDecisions
  // Ticking a warning group changes the acknowledgements; the wizard saves the decisions and returns a fresh token.
  onDecisionsChange: (next: ImportDecisions) => void
  // How the consumer words one planned change. Default: its label, and for an update the old to new values.
  describeChange?: (change: PlannedChange) => DescribedChange
  // Plural names of the entity types for the list headings ({ MATCH: 'Matches' }); default: the type, tidied.
  entityLabels?: Record<string, string>
  // Spec 125 amendment: a quiet "Teams: 10 matched, 2 new" line with a "Change Teams" action that opens the team step; omitted, no line.
  teamSummary?: { matched: number; created: number } | null
  teamsLabel?: string
  onChangeTeams?: () => void
  // The ours-only step's action ("Change <changeOursLabel>"), only when the type identifies what is ours.
  changeOursLabel?: string
  onChangeOurs?: () => void
  onBack: () => void
  onConfirm: () => void
  // A save of the decisions is in flight (Confirm waits for the fresh token).
  saving?: boolean
  confirming?: boolean
  confirmLabel?: string
  // A refused commit or save, shown above the footer.
  errorMessage?: string | null
}

const PREVIEW_COUNT = 8

function tidy(entityType: string): string {
  const words = entityType.toLowerCase().replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function changeValue(value: unknown): string {
  if (value && typeof value === 'object' && 'from' in value && 'to' in value) {
    const { from, to } = value as { from: unknown; to: unknown }
    return `${String(from ?? '-')} → ${String(to ?? '-')}`
  }
  return value === null || value === undefined ? '-' : String(value)
}

function defaultDescribe(change: PlannedChange): DescribedChange {
  const entries = Object.entries(change.changes)
  return { title: change.label, detail: entries.length > 0 ? entries.map(([key, value]) => `${key}: ${changeValue(value)}`).join(', ') : undefined }
}

function ChangeList({ heading, changes, describe, tone }: { heading: string; changes: PlannedChange[]; describe: (change: PlannedChange) => DescribedChange; tone: 'new' | 'update' }) {
  const [all, setAll] = useState(false)
  const shown = all ? changes : changes.slice(0, PREVIEW_COUNT)
  return (
    <Box component="section" aria-label={heading}>
      <Typography component="h3" sx={{ fontWeight: 700, fontSize: '1.05rem', mt: 1.5, mb: 0.5 }}>{heading}</Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {shown.map((change, index) => {
          const described = describe(change)
          return (
            <Box component="li" key={`${change.entityType}-${change.rowNumber}-${index}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.75, borderBottom: 1, borderColor: 'divider', fontSize: '0.8125rem', alignItems: 'flex-start' }}>
              <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {described.title}
                {described.detail && <Typography component="div" variant="caption" color="text.secondary">{described.detail}</Typography>}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: 'none' }}>
                {change.rowNumber !== null && <Typography variant="caption" color="text.secondary">{importRowLabel(change.rowNumber)}</Typography>}
                {tone === 'new' && <ImportOutcomeChip outcome="NEW" />}
              </Box>
            </Box>
          )
        })}
      </Box>
      {changes.length > PREVIEW_COUNT && (
        <Button size="compact" variant="ghost" onClick={() => setAll((current) => !current)} sx={{ mt: 0.5, minHeight: { xs: 44, md: 32 } }}>
          {all ? 'Show fewer' : `Show all ${changes.length}`}
        </Button>
      )}
    </Box>
  )
}

// docs/specs/097-import-framework.md, Review step: the counts, everything that will be created or updated, the warnings grouped
// by kind each with its own tick, an Alert saying nothing has been saved yet, and the primary Confirm button, disabled with the
// reason beside it until there are no errors and every warning is acknowledged. The button is full width and sticky on a phone.
export function ImportConfirmPanel({ batch, decisions, onDecisionsChange, describeChange = defaultDescribe, entityLabels = {}, teamSummary, teamsLabel = 'Teams', onChangeTeams, changeOursLabel = 'our teams', onChangeOurs, onBack, onConfirm, saving = false, confirming = false, confirmLabel = 'Confirm and Import', errorMessage }: ImportConfirmPanelProps) {
  const issues = batch.issues ?? []
  const planned = batch.plannedChanges ?? []
  const created = planned.filter((change) => change.action === 'CREATED')
  const updated = planned.filter((change) => change.action === 'UPDATED')
  const byType = new Map<string, PlannedChange[]>()
  for (const change of created) byType.set(change.entityType, [...(byType.get(change.entityType) ?? []), change])

  const errors = importCount(batch, 'errors')
  const skippedNotOurs = importCount(batch, 'skippedNotOurs')
  const groups = warningGroups(issues, decisions)
  const unacknowledged = groups.filter((group) => !group.acknowledged).length
  const ready = errors === 0 && unacknowledged === 0 && Boolean(batch.confirmationToken) && !saving
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  const reason = errors > 0
    ? `Fix or exclude ${plural(errors, 'error', 'errors')} to continue.`
    : unacknowledged > 0
      ? `Acknowledge ${plural(unacknowledged, 'warning', 'warnings')} to continue.`
      : saving
        ? 'Saving your choices...'
        : !batch.confirmationToken
          ? 'Preparing the confirmation...'
          : null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
      <Alert severity="info">Nothing has been saved yet. Records are only created when you press {confirmLabel}.</Alert>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1 }}>
        <KeyFigureTile compact testId="tile-created" icon={<NoteAddOutlinedIcon fontSize="small" />} value={importCount(batch, 'created')} label="Will be created" />
        <KeyFigureTile compact testId="tile-updated" icon={<EditOutlinedIcon fontSize="small" />} value={importCount(batch, 'updated')} label="Will be updated" />
        <KeyFigureTile compact testId="tile-duplicates" icon={<ContentCopyOutlinedIcon fontSize="small" />} value={importCount(batch, 'duplicates')} label="Already exist, skipped" />
        {skippedNotOurs > 0 && <KeyFigureTile compact testId="tile-not-ours" icon={<RemoveCircleOutlineIcon fontSize="small" />} value={skippedNotOurs} label="Not ours, not imported" />}
        {importCount(batch, 'excluded') > 0 && <KeyFigureTile compact testId="tile-excluded" icon={<VisibilityOffOutlinedIcon fontSize="small" />} value={importCount(batch, 'excluded')} label="Excluded by you" />}
      </Box>

      {teamSummary && (
        <Box data-testid="team-summary" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1 }}>
          <Typography variant="body2" color="text.secondary">{teamsLabel}: {teamSummary.matched} matched, {teamSummary.created} new</Typography>
          {onChangeTeams && <Button size="compact" variant="ghost" disabled={saving || confirming} onClick={onChangeTeams} sx={{ minHeight: { xs: 44, md: 32 } }}>Change Teams</Button>}
          {onChangeOurs && <Button size="compact" variant="ghost" disabled={saving || confirming} onClick={onChangeOurs} sx={{ minHeight: { xs: 44, md: 32 } }}>{`Change ${changeOursLabel.toLowerCase()}`}</Button>}
        </Box>
      )}

      {skippedNotOurs > 0 && (
        <Alert severity="warning">
          {skippedNotOurs} of {importCount(batch, 'rows')} rows do not involve your records and will not be imported.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 3, alignItems: 'start' }}>
        <Box>
          {[...byType.entries()].map(([entityType, changes]) => (
            <ChangeList key={entityType} heading={`${entityLabels[entityType] ?? tidy(entityType)} that will be created (${changes.length})`} changes={changes} describe={describeChange} tone="new" />
          ))}
          {updated.length > 0 && <ChangeList heading={`To be updated (${updated.length})`} changes={updated} describe={describeChange} tone="update" />}
          {created.length === 0 && updated.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Nothing will be created or updated.</Typography>}
        </Box>
        <Box component="section" aria-label="Warnings to acknowledge">
          <Typography component="h3" sx={{ fontWeight: 700, fontSize: '1.05rem', mt: 1.5, mb: 0.5 }}>Warnings to acknowledge</Typography>
          {groups.length === 0 && <Typography variant="body2" color="text.secondary">No warnings.</Typography>}
          {groups.map((group) => (
            <Box key={group.code} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', mb: 0.75, px: 1.25, py: 0.25 }}>
              <FormControlLabel
                sx={{ ml: 0, alignItems: 'flex-start', minHeight: 44, width: '100%' }}
                control={<Checkbox checked={group.acknowledged} disabled={saving || confirming} onChange={(event) => onDecisionsChange(withAcknowledgement(decisions, issues, group.code, event.target.checked))} sx={{ mt: 0.25 }} />}
                label={
                  <Box sx={{ py: 0.75 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {group.message}
                      {group.rowNumbers.length > 0 && ` (${plural(group.rowNumbers.length, 'row', 'rows')})`}
                    </Typography>
                    {group.rowNumbers.length > 0 && <Typography variant="caption" color="text.secondary">{importRowLabels(group.rowNumbers)}.</Typography>}
                    {group.hint && <Typography variant="caption" color="text.secondary" component="div">{group.hint}</Typography>}
                  </Box>
                }
              />
            </Box>
          ))}
        </Box>
      </Box>

      {errorMessage && <Alert severity="error" role="alert">{errorMessage}</Alert>}

      <Box
        data-testid="confirm-footer"
        sx={{ position: { xs: 'sticky', md: 'static' }, bottom: 0, zIndex: 2, bgcolor: { xs: 'background.paper', md: 'transparent' }, borderTop: { xs: 1, md: 0 }, borderColor: 'divider', py: { xs: 1, md: 0 }, display: 'flex', flexDirection: 'column', gap: 0.75 }}
      >
        {reason && (
          <Typography variant="body2" role="status" sx={{ color: 'error.main', textAlign: { xs: 'center', md: 'left' } }}>
            {reason}
          </Typography>
        )}
        <WizardFooter back={{ label: 'Back', onClick: onBack, disabled: confirming }} primary={{ label: confirming ? 'Importing...' : confirmLabel, onClick: onConfirm, disabled: !ready || confirming }} />
      </Box>
    </Box>
  )
}
