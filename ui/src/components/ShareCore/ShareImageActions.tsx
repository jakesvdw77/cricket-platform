import { useState } from 'react'
import { useCopyImage } from '../../hooks/useCopyImage'
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

// docs/specs/114-share-result.md (Preview and delivery): the main button is chosen by capability. Share where the browser can
// share this file, otherwise Download PNG; Copy image where ClipboardItem exists. Cancelling the share sheet is not an error.
export function ShareImageActions({ file, shareTitle, error }: ShareImageActionsProps) {
  const capability = useShareCapability()
  const [failure, setFailure] = useState<string | null>(null)
  const clipboardImage = useCopyImage()
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
    setFailure(null)
    await clipboardImage.copyImage(file)
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
          Download PNG
        </Button>
        {clipboardImage.canCopyImage && (
          <Button
            size="compact"
            variant="secondary"
            startIcon={<ContentCopyOutlinedIcon />}
            disabled={!file}
            onClick={() => void copyImage()}
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
        {failure ?? clipboardImage.message}
      </Typography>
    </Box>
  )
}
