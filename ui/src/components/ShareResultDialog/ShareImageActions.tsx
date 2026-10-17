import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { downloadFile } from '../../utils/share/downloadFile'
import { useShareCapability } from '../../utils/share/useShareCapability'
import { Button } from '../Button'

export interface ShareImageActionsProps {
  // The generated PNG; null while it is being made or when generation failed.
  file: File | null
  // Team names only: never a player name.
  shareTitle: string
  error: string | null
}

const TOUCH_TARGET_SX = { minHeight: { xs: 44, sm: 'auto' } }

const canCopyImage = (): boolean =>
  typeof ClipboardItem !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.clipboard?.write === 'function'

// docs/specs/114-share-result.md (Preview and delivery): the main button is chosen by capability. Share where the browser can
// share this file, otherwise Download PNG; Copy image where ClipboardItem exists. Cancelling the share sheet is not an error.
export function ShareImageActions({ file, shareTitle, error }: ShareImageActionsProps) {
  const capability = useShareCapability()
  const [status, setStatus] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const canShare = file !== null && capability.canShareFiles(file)

  const share = async () => {
    if (!file) return
    setFailure(null)
    try {
      await navigator.share({ files: [file], title: shareTitle })
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setFailure('Could not open the share sheet. Download the image instead.')
    }
  }

  const copyImage = async () => {
    if (!file) return
    setFailure(null)
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })])
      setStatus('Image copied.')
    } catch {
      setStatus(null)
      setFailure("Couldn't copy the image. Download it instead.")
    }
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
            Download PNG
          </Button>
        )}
        {canCopyImage() && (
          <Button
            variant="secondary"
            startIcon={<ContentCopyOutlinedIcon />}
            disabled={!file}
            onClick={() => void copyImage()}
            sx={TOUCH_TARGET_SX}
          >
            Copy image
          </Button>
        )}
      </Box>
      {error && (
        <Typography variant="body2" color="error" role="alert" sx={{ mt: 0.75 }}>
          {error}
        </Typography>
      )}
      <Typography
        variant="caption"
        color={failure ? 'error.main' : 'text.secondary'}
        role="status"
        aria-live="polite"
        sx={{ display: 'block', mt: 0.5 }}
      >
        {failure ?? status}
      </Typography>
    </Box>
  )
}
