import { Chip } from '@mui/material'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { MANAGE_BUTTON_WIDTH } from '../../../../components/ManageMenu/ManageMenu'
import { badgeSx } from '../../../../components/RecordCard'
import { importedProvider } from './importSource'

// docs/specs/104-match-results-import-adaptors.md: "Imported from STUMPS", from the result's `source`, in the capture header
// and on the Result page header. Nothing for a result that was not imported. Icon plus words, never colour alone.
// `matchButton` (docs/specs/138, owner 2026-11-05): the size of the Manage button under it on a detail page header (same width, 32 px high).
export function ImportedChip({ source, matchButton = false }: { source: string | null | undefined; matchButton?: boolean }) {
  const provider = importedProvider(source)
  if (!provider) return null
  return (
    <Chip
      size="small"
      icon={<FileDownloadOutlinedIcon sx={{ fontSize: 14 }} />}
      label={`Imported from ${provider}`}
      data-testid="imported-chip"
      sx={{
        ...badgeSx('side'),
        height: 24,
        fontSize: '0.75rem',
        alignSelf: 'flex-start',
        ...(matchButton && { height: 32, width: { xs: '100%', sm: MANAGE_BUTTON_WIDTH }, alignSelf: { xs: 'stretch', sm: 'flex-end' }, justifyContent: 'center', fontSize: '0.8125rem' }),
      }}
    />
  )
}
