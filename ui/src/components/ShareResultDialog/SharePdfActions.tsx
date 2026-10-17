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

const TOUCH_TARGET_SX = { minHeight: { xs: 44, sm: 'auto' } }
// How long a Print tab keeps its object URL before it is released.
const PRINT_URL_LIFETIME_MS = 60_000

// docs/specs/114-share-result.md (Preview and delivery): Share where the browser can share this file, otherwise Download
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
        {canShare ? (
          <Button startIcon={<ShareOutlinedIcon />} onClick={() => void share()} sx={TOUCH_TARGET_SX}>
            Share
          </Button>
        ) : (
          <Button startIcon={<FileDownloadOutlinedIcon />} disabled={!file} onClick={() => file && downloadFile(file)} sx={TOUCH_TARGET_SX}>
            Download PDF
          </Button>
        )}
        <Button variant="secondary" startIcon={<PrintOutlinedIcon />} disabled={!file} onClick={print} sx={TOUCH_TARGET_SX}>
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
