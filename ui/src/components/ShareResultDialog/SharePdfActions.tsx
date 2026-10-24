import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { downloadFile } from '../../utils/share/downloadFile'
import { useShareCapability } from '../../utils/share/useShareCapability'
import { Button } from '../Button'

export interface SharePdfActionsProps {
  // The generated PDF; null while it is being made or when generation failed.
  file: File | null
  // Team names only: never a player name.
  shareTitle: string
  error: string | null
}

// How long a Print tab keeps its object URL before it is released.
const PRINT_URL_LIFETIME_MS = 60_000

// docs/specs/114-share-result.md (Preview and delivery): Share where the browser can share this file, and Download always
// PDF; Print opens the PDF in a new tab. Cancelling the share sheet is not an error.
export function SharePdfActions({ file, shareTitle, error }: SharePdfActionsProps) {
  const capability = useShareCapability()
  const [failure, setFailure] = useState<string | null>(null)
  const canShare = file !== null && capability.canShareFiles(file)

  const share = async () => {
    if (!file) return
    setFailure(null)
    try {
      await navigator.share({ files: [file], title: shareTitle })
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setFailure('Could not open the share sheet. Download the PDF instead.')
    }
  }

  const print = () => {
    if (!file) return
    const url = URL.createObjectURL(file)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), PRINT_URL_LIFETIME_MS)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {canShare && (
          <Button size="compact" startIcon={<ShareOutlinedIcon />} onClick={() => void share()}>
            Share
          </Button>
        )}
        <Button size="compact" variant={canShare ? 'secondary' : 'primary'} startIcon={<FileDownloadOutlinedIcon />} disabled={!file} onClick={() => file && downloadFile(file)}>
          Download PDF
        </Button>
        <Button size="compact" variant="secondary" startIcon={<PrintOutlinedIcon />} disabled={!file} onClick={print}>
          Print
        </Button>
      </Box>
      {error && (
        <Typography variant="body2" color="error" role="alert" sx={{ mt: 0.75 }}>
          {error}
        </Typography>
      )}
      <Typography variant="caption" color="error.main" role="status" aria-live="polite" sx={{ display: 'block', mt: 0.5 }}>
        {failure}
      </Typography>
    </Box>
  )
}
