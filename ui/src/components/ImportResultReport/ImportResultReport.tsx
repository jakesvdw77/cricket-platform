import { useState } from 'react'
import { importRowLabels } from '../../utils/importRowLabel'
import { Alert, Box, Button as MuiButton, Typography } from '@mui/material'
import type { QueryKey } from '@tanstack/react-query'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { importCount, importErrorMessage, importSourceName, importTypedSummary, listAllImportRows } from '../../api/importApi'
import type { ImportBatch } from '../../api/importApi'
import { isNotImported, rowsToCsv } from '../../utils/importRowsCsv'
import { triggerDownload } from '../../utils/triggerDownload'
import { Button, compactButtonSx } from '../Button'
import { KeyFigureTile } from '../KeyFigureTile'
import { ImportDeleteDialog } from './ImportDeleteDialog'

export interface ImportResultLink {
  label: string
  to: string
}

export interface ImportResultReportProps {
  clubId: string
  batch: ImportBatch
  // Buttons to the imported data (the consumer's: "View the schedule").
  resultLinks?: ImportResultLink[]
  // The keys of the data the import changed, refetched after a delete.
  invalidateKeys?: QueryKey[]
}

function when(value: string | null): string {
  if (!value) return ''
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

// docs/specs/097-import-framework.md, step 7 (Report): what was created, updated, skipped and excluded as key figures, the
// warnings acknowledged, links to the imported data, the "rows not imported" CSV, the batch reference and the destructive
// Delete import (which opens the deletion check). A deleted batch shows what was removed and kept instead.
export function ImportResultReport({ clubId, batch, resultLinks = [], invalidateKeys }: ImportResultReportProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const deleted = batch.status === 'DELETED'
  const typedSummary = importTypedSummary(batch)
  const acknowledged = (batch.issues ?? []).filter((issue) => issue.severity === 'WARNING')

  const downloadNotImported = async () => {
    setDownloading(true)
    setDownloadError(null)
    try {
      const rows = (await listAllImportRows(clubId, batch.id)).filter(isNotImported)
      const csv = rowsToCsv(rows, batch.issues ?? [])
      triggerDownload(URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), `rows-not-imported-${batch.id}.csv`)
    } catch (error) {
      setDownloadError(importErrorMessage(error, 'We could not build the file. The rows may no longer be stored.'))
    } finally {
      setDownloading(false)
    }
  }

  const figureList = (title: string, figures: unknown) => {
    const entries = Object.entries((figures ?? {}) as Record<string, number>).filter(([, count]) => count > 0)
    if (entries.length === 0) return null
    return <Typography variant="body2">{title}: {entries.map(([name, count]) => `${count} ${name}`).join(', ')}.</Typography>
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
      {deleted ? (
        <Alert severity="info">
          <Typography variant="body2" fontWeight={700}>This import was deleted{batch.deletedAt ? ` on ${when(batch.deletedAt)}` : ''}.</Typography>
          {figureList('Removed', batch.counts.deleted)}
          {figureList('Kept', batch.counts.kept)}
        </Alert>
      ) : (
        <Alert severity="success">The import is complete{batch.committedAt ? `: ${when(batch.committedAt)}` : ''}.</Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 1 }}>
        <KeyFigureTile compact emphasis="success" testId="report-created" icon={<NoteAddOutlinedIcon fontSize="small" />} value={importCount(batch, 'created')} label="Created" />
        <KeyFigureTile compact testId="report-updated" icon={<EditOutlinedIcon fontSize="small" />} value={importCount(batch, 'updated')} label="Updated" />
        <KeyFigureTile compact testId="report-duplicates" icon={<ContentCopyOutlinedIcon fontSize="small" />} value={importCount(batch, 'duplicates')} label="Already existed" />
        <KeyFigureTile compact testId="report-not-ours" icon={<RemoveCircleOutlineIcon fontSize="small" />} value={importCount(batch, 'skippedNotOurs')} label="Not ours" />
        <KeyFigureTile compact testId="report-excluded" icon={<VisibilityOffOutlinedIcon fontSize="small" />} value={importCount(batch, 'excluded')} label="Excluded" />
      </Box>

      {acknowledged.length > 0 && (
        <Box component="section" aria-label="Warnings acknowledged">
          <Typography component="h3" sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 0.5 }}>Warnings you acknowledged ({acknowledged.length})</Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {acknowledged.map((issue, index) => <Typography component="li" variant="body2" key={`${issue.code}-${index}`}>{issue.message}{issue.rowNumbers.length > 0 ? ` (${importRowLabels(issue.rowNumbers)})` : ''}</Typography>)}
          </Box>
        </Box>
      )}

      {typedSummary && <Typography variant="body2" data-testid="report-typed">{typedSummary}.</Typography>}
      <Typography variant="caption" color="text.secondary">Import reference: {batch.id}{batch.source === 'MANUAL' || batch.fileName ? `, ${batch.source === 'MANUAL' ? importSourceName(batch) : `file ${batch.fileName}`}` : ''}</Typography>

      {downloadError && <Alert severity="error" role="alert">{downloadError}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' } }}>
        {!deleted && resultLinks.map((link) => (
          <MuiButton key={link.to} variant="contained" size="small" component={RouterLink} to={link.to} sx={{ ...compactButtonSx, minHeight: { xs: 44, md: 32 } }}>{link.label}</MuiButton>
        ))}
        <Button size="compact" variant="secondary" startIcon={<FileDownloadOutlinedIcon />} disabled={downloading} onClick={() => void downloadNotImported()} sx={{ minHeight: { xs: 44, md: 32 } }}>
          {downloading ? 'Preparing...' : 'Download rows not imported'}
        </Button>
        {batch.status === 'COMMITTED' && (
          <Button size="compact" variant="secondary" startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteOpen(true)} sx={{ minHeight: { xs: 44, md: 32 }, color: 'error.main', borderColor: 'error.main', '&:hover': { borderColor: 'error.dark', bgcolor: 'action.hover' } }}>
            Delete import
          </Button>
        )}
      </Box>

      <ImportDeleteDialog clubId={clubId} batchId={batch.id} open={deleteOpen} onClose={() => setDeleteOpen(false)} invalidateKeys={invalidateKeys} />
    </Box>
  )
}
