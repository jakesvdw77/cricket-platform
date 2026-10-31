import { Chip } from '@mui/material'
import type { ChipProps } from '@mui/material'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import FileCopyOutlinedIcon from '@mui/icons-material/FileCopyOutlined'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { ImportOutcome, ImportRow, ImportRowStatus } from '../../api/importApi'

// docs/specs/097-import-framework.md: status is always an icon plus a word, never colour alone.
const STATUS: Record<ImportRowStatus, { label: string; color: ChipProps['color']; icon: ChipProps['icon'] }> = {
  OK: { label: 'OK', color: 'success', icon: <CheckCircleOutlineIcon /> },
  WARNING: { label: 'Warning', color: 'warning', icon: <WarningAmberIcon /> },
  ERROR: { label: 'Error', color: 'error', icon: <ErrorOutlineIcon /> },
  SKIPPED_NOT_OURS: { label: 'Skipped, not ours', color: 'default', icon: <RemoveCircleOutlineIcon /> },
}

const OUTCOME: Record<ImportOutcome, { label: string; color: ChipProps['color']; icon: ChipProps['icon'] }> = {
  NEW: { label: 'New', color: 'warning', icon: <AddCircleOutlineIcon /> },
  DUPLICATE: { label: 'Already exists', color: 'success', icon: <CheckCircleOutlineIcon /> },
  DIFFERS: { label: 'Differs', color: 'info', icon: <CompareArrowsIcon /> },
  POSSIBLE_DUPLICATE: { label: 'Possible duplicate', color: 'warning', icon: <FileCopyOutlinedIcon /> },
  SKIPPED_NOT_OURS: STATUS.SKIPPED_NOT_OURS,
}

const chipSx = { fontWeight: 600, flex: 'none', '& .MuiChip-icon': { fontSize: 16 } } as const

export function ImportStatusChip({ status }: { status: ImportRowStatus }) {
  const entry = STATUS[status]
  return <Chip size="small" variant="outlined" color={entry.color} icon={entry.icon} label={entry.label} sx={chipSx} />
}

// A row that only waits for a later step (for example its team is matched there): neutral, not a failure.
export function ImportPendingChip({ label }: { label: string }) {
  return <Chip size="small" variant="outlined" icon={<HourglassEmptyIcon />} label={label} sx={chipSx} />
}

export function ImportOutcomeChip({ outcome }: { outcome: ImportOutcome }) {
  const entry = OUTCOME[outcome]
  return <Chip size="small" variant="outlined" color={entry.color} icon={entry.icon} label={entry.label} sx={chipSx} />
}

// The one chip a row shows: an error and a skip win; then the outcome words that need a decision or explain a skip; then the status.
export function ImportRowChip({ row }: { row: Pick<ImportRow, 'status' | 'outcome'> }) {
  if (row.status === 'ERROR' || row.status === 'SKIPPED_NOT_OURS') return <ImportStatusChip status={row.status} />
  if (row.outcome === 'DUPLICATE' || row.outcome === 'DIFFERS' || row.outcome === 'POSSIBLE_DUPLICATE') return <ImportOutcomeChip outcome={row.outcome} />
  return <ImportStatusChip status={row.status} />
}
