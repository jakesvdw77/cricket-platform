import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import type { QueryKey } from '@tanstack/react-query'
import { Link as RouterLink } from 'react-router-dom'
import { importDeletionBlockers, importErrorMessage, useDeleteImport, useDeletionCheck } from '../../api/importApi'
import type { DeletionBlocker, ImportBatch } from '../../api/importApi'
import { ConfirmDialog } from '../ConfirmDialog'

export interface ImportDeleteDialogProps {
  clubId: string
  // The batch to delete; null while the dialog is closed.
  batchId: string | null
  open: boolean
  onClose: () => void
  // The keys of the data the import changed (the consumer's), refetched after a delete.
  invalidateKeys?: QueryKey[]
  onDeleted?: (batch: ImportBatch) => void
}

function counts(title: string, figures: Record<string, number>) {
  const entries = Object.entries(figures).filter(([, count]) => count > 0)
  if (entries.length === 0) return null
  return (
    <Box>
      <Typography variant="body2" fontWeight={700}>{title}</Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {entries.map(([name, count]) => <li key={name}>{count} {name}</li>)}
      </Box>
    </Box>
  )
}

function Blockers({ blockers }: { blockers: DeletionBlocker[] }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2">Something this import created is now in use. Nothing was deleted. Deal with these first:</Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {blockers.map((blocker, index) => (
          <li key={`${blocker.entityId ?? 'blocker'}-${index}`}>
            <Typography variant="body2" fontWeight={700} component="span">{blocker.label}</Typography>
            {blocker.detail && <Typography variant="body2" component="div" color="text.secondary">{blocker.detail}</Typography>}
            {blocker.link && <Typography variant="body2" component={RouterLink} to={blocker.link} sx={{ color: 'primary.main' }}>Open it</Typography>}
          </li>
        ))}
      </Box>
    </Box>
  )
}

// docs/specs/097-import-framework.md, steps 8 (Undo or delete): the check ("Can this be deleted?") and the guarded destructive
// confirm. A blocked import is an acknowledge-only dialog listing the blockers with links; the server re-checks inside the delete
// transaction, and a refusal there shows the same list. Never writes until the manager confirms.
export function ImportDeleteDialog({ clubId, batchId, open, onClose, invalidateKeys, onDeleted }: ImportDeleteDialogProps) {
  const check = useDeletionCheck(clubId, batchId, open)
  const remove = useDeleteImport(clubId, invalidateKeys)
  const [refusedBlockers, setRefusedBlockers] = useState<DeletionBlocker[]>([])

  const close = () => {
    setRefusedBlockers([])
    remove.reset()
    onClose()
  }

  if (check.isPending || check.isError) {
    return (
      <ConfirmDialog
        open={open}
        title="Delete this import?"
        description={check.isError ? 'We could not check whether this import can be deleted. Please try again.' : 'Checking whether this import can be deleted...'}
        confirmLabel="Delete import"
        pendingLabel="Checking..."
        pending={check.isPending}
        destructive
        acknowledgeOnly={check.isError}
        onClose={close}
      />
    )
  }

  const blockers = refusedBlockers.length > 0 ? refusedBlockers : check.data.blockers
  if (!check.data.deletable || refusedBlockers.length > 0) {
    return <ConfirmDialog open={open} title="This import cannot be deleted" description={<Blockers blockers={blockers} />} acknowledgeOnly confirmLabel="Close" onClose={close} />
  }

  return (
    <ConfirmDialog
      open={open}
      title="Delete this import?"
      destructive
      confirmLabel="Delete import"
      pendingLabel="Deleting..."
      pending={remove.isPending}
      description={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2">Everything this import created will be removed. This cannot be undone.</Typography>
          {counts('Will be deleted', check.data.willDelete)}
          {counts('Will be kept', check.data.willKeep)}
          {remove.isError && importDeletionBlockers(remove.error).length === 0 && <Typography variant="body2" color="error" role="alert">{importErrorMessage(remove.error)}</Typography>}
        </Box>
      }
      onConfirm={() =>
        remove.mutate(batchId as string, {
          onSuccess: (deleted) => {
            onDeleted?.(deleted)
            close()
          },
          onError: (error) => setRefusedBlockers(importDeletionBlockers(error)),
        })
      }
      onClose={close}
    />
  )
}
