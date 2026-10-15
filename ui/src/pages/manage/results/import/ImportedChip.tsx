import { Chip } from '@mui/material'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { badgeSx } from '../../../../components/RecordCard'
import { importedProvider } from './importSource'

// docs/specs/104-match-results-import-adaptors.md: "Imported from STUMPS", from the result's `source`, in the capture header
// and on the Result page header. Nothing for a result that was not imported. Icon plus words, never colour alone.
export function ImportedChip({ source }: { source: string | null | undefined }) {
  const provider = importedProvider(source)
  if (!provider) return null
  return (
    <Chip
      size="small"
      icon={<FileDownloadOutlinedIcon sx={{ fontSize: 14 }} />}
      label={`Imported from ${provider}`}
      data-testid="imported-chip"
      sx={{ ...badgeSx('side'), height: 24, fontSize: '0.75rem', alignSelf: 'flex-start' }}
    />
  )
}
