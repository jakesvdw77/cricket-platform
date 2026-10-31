import { useState } from 'react'
import { Alert, Box, Chip, CircularProgress, FormControlLabel, Pagination, Switch, Typography } from '@mui/material'
import type { QueryKey } from '@tanstack/react-query'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined'
import { IMPORT_HISTORY_PAGE_SIZE, importCount, importErrorMessage, importSourceName, importTypedSummary, useDiscardImport, useImportHistory } from '../../api/importApi'
import type { ImportBatch, ImportBatchStatus } from '../../api/importApi'
import { ConfirmDialog } from '../ConfirmDialog'
import { ImportDeleteDialog } from '../ImportResultReport'
import { RowActions } from '../RowActions'
import { SidePanel } from '../SidePanel'

export interface ImportHistoryPanelProps {
  clubId: string
  open: boolean
  onClose: () => void
  // Narrow the list to one import type and scope (the consumer's league and season).
  type?: string
  scopeKey?: string
  onOpenReport: (batch: ImportBatch) => void
  onResume: (batch: ImportBatch) => void
  // The keys of the data an import changed, refetched after Delete import.
  invalidateKeys?: QueryKey[]
}

const STATUS_LABEL: Record<ImportBatchStatus, string> = { PREVIEW: 'In progress', COMMITTED: 'Imported', DISCARDED: 'Discarded', EXPIRED: 'Expired', DELETED: 'Deleted' }
const STATUS_COLOR: Record<ImportBatchStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = { PREVIEW: 'info', COMMITTED: 'success', DISCARDED: 'default', EXPIRED: 'default', DELETED: 'error' }

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''
}

function Body({ clubId, type, scopeKey, onOpenReport, onResume, onDelete }: Pick<ImportHistoryPanelProps, 'clubId' | 'type' | 'scopeKey' | 'onOpenReport' | 'onResume'> & { onDelete: (batch: ImportBatch) => void }) {
  const [page, setPage] = useState(0)
  const [includeEnded, setIncludeEnded] = useState(false)
  const [discarding, setDiscarding] = useState<ImportBatch | null>(null)
  const [discardError, setDiscardError] = useState<string | null>(null)
  const history = useImportHistory(clubId, { type, scopeKey, includeEnded, page, size: IMPORT_HISTORY_PAGE_SIZE })
  const discard = useDiscardImport(clubId)

  const confirmDiscard = () => {
    if (!discarding) return
    discard.mutate(discarding.id, {
      onSuccess: () => {
        setDiscarding(null)
        setDiscardError(null)
      },
      onError: (error) => {
        setDiscarding(null)
        setDiscardError(importErrorMessage(error, 'We could not discard this import.'))
      },
    })
  }

  const toggle = (
    <FormControlLabel
      sx={{ m: 0, minHeight: 44 }}
      control={<Switch size="small" checked={includeEnded} onChange={(event) => { setIncludeEnded(event.target.checked); setPage(0) }} />}
      label={<Typography variant="body2">Show deleted and discarded</Typography>}
    />
  )

  let list
  if (history.isPending) list = <CircularProgress size={22} aria-label="Loading import history" sx={{ alignSelf: 'center', m: 2 }} />
  else if (history.isError) list = <Alert severity="error">We could not load the import history.</Alert>
  else if (history.data.content.length === 0) list = <Typography variant="body2" color="text.secondary">No imports yet.</Typography>
  else list = (
    <>
      {history.data.content.map((batch) => (
        <Box key={batch.id} data-testid={`history-${batch.id}`} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1.25, display: 'flex', gap: 1, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{importSourceName(batch)}</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', my: 0.5 }}>
              <Chip size="small" variant="outlined" color={STATUS_COLOR[batch.status]} label={STATUS_LABEL[batch.status]} sx={{ fontWeight: 600 }} />
              {batch.scopeMode && <Chip size="small" variant="outlined" label={batch.scopeMode === 'OURS_ONLY' ? 'Ours only' : 'Everything'} />}
            </Box>
            <Typography variant="caption" color="text.secondary" component="div">{when(batch.committedAt ?? batch.createdAt)}</Typography>
            <Typography variant="caption" color="text.secondary" component="div">
              {importCount(batch, 'rows')} rows, {importCount(batch, 'created')} created, {importCount(batch, 'updated')} updated{importTypedSummary(batch) ? `, ${importTypedSummary(batch)}` : ''}
            </Typography>
          </Box>
          <RowActions
            label={importSourceName(batch, 'import')}
            actions={[
              { id: 'report', label: 'Open report', icon: <DescriptionOutlinedIcon fontSize="small" />, onClick: () => onOpenReport(batch), hidden: batch.status !== 'COMMITTED' && batch.status !== 'DELETED' },
              { id: 'resume', label: 'Resume', icon: <PlayArrowOutlinedIcon fontSize="small" />, onClick: () => onResume(batch), hidden: batch.status !== 'PREVIEW' },
              { id: 'discard', label: 'Discard', icon: <CloseOutlinedIcon fontSize="small" />, destructive: true, onClick: () => { setDiscardError(null); setDiscarding(batch) }, hidden: batch.status !== 'PREVIEW' },
              { id: 'delete', label: 'Delete import', icon: <DeleteOutlineIcon fontSize="small" />, destructive: true, onClick: () => onDelete(batch), hidden: batch.status !== 'COMMITTED' },
            ]}
          />
        </Box>
      ))}
      {history.data.totalPages > 1 && <Pagination count={history.data.totalPages} page={page + 1} size="small" onChange={(_event, next) => setPage(next - 1)} />}
    </>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      {toggle}
      {discardError && <Alert severity="error" onClose={() => setDiscardError(null)}>{discardError}</Alert>}
      {list}
      <ConfirmDialog
        open={discarding !== null}
        title="Discard this import?"
        description="Discard this import? Nothing has been saved from it. This cannot be undone."
        confirmLabel="Discard"
        pendingLabel="Discarding..."
        destructive
        pending={discard.isPending}
        onConfirm={confirmDiscard}
        onClose={() => setDiscarding(null)}
      />
    </Box>
  )
}

// docs/specs/097-import-framework.md: the import history of a scope in a SidePanel (a bottom sheet on a phone): status chip,
// scope chip, when and the counts, with Open report, Resume (an unfinished preview) and Discard (an unfinished preview) and Delete import as row actions. The
// batch DTO has no user name, so "who" is not shown. No current-person hook exists to compare createdBy with, so Discard shows
// on every in-progress row and the server's refusal (only the creator may discard) is shown in an Alert.
export function ImportHistoryPanel({ clubId, open, onClose, type, scopeKey, onOpenReport, onResume, invalidateKeys }: ImportHistoryPanelProps) {
  const [deleting, setDeleting] = useState<string | null>(null)
  return (
    <>
      <SidePanel open={open} onClose={onClose} title="Import history" closeLabel="Close import history">
        {() => <Body clubId={clubId} type={type} scopeKey={scopeKey} onOpenReport={onOpenReport} onResume={onResume} onDelete={(batch) => setDeleting(batch.id)} />}
      </SidePanel>
      <ImportDeleteDialog clubId={clubId} batchId={deleting} open={deleting !== null} onClose={() => setDeleting(null)} invalidateKeys={invalidateKeys} />
    </>
  )
}
