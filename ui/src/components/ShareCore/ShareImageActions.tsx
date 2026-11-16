import { useState } from 'react'
import { useCopyImage } from '../../hooks/useCopyImage'
import { Box, Typography } from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { downloadFile } from '../../utils/share/downloadFile'
import { useShareCapability } from '../../utils/share/useShareCapability'
import { Button } from '../Button'
import { SplitButton } from '../SplitButton'

export interface ShareImageActionsProps {
  // The generated PNG; null while it is being made or when generation failed.
  file: File | null
  // Team names only: never a player name.
  shareTitle: string
  error: string | null
  // Other sizes of the same picture (Square, Portrait, Story), for the formats that have them. Each makes its own file on demand,
  // so Download PNG and Share can ask which size at the moment of use. `current` is the size the preview shows (the main button).
  sizes?: { current: string; options: { id: string; label: string; make: () => Promise<File> }[] }
}

// docs/specs/114-share-result.md (Preview and delivery): the main button is chosen by capability. Share where the browser can
// share this file, otherwise Download PNG; Copy image where ClipboardItem exists. Cancelling the share sheet is not an error.
export function ShareImageActions({ file, shareTitle, error, sizes }: ShareImageActionsProps) {
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

  // Another size: the file is made when asked for, then shared or downloaded, and the preview is left as it was.
  const [making, setMaking] = useState(false)
  const otherSizes = sizes ? sizes.options.filter((item) => item.id !== sizes.current) : []
  const withSize = async (id: string, handOut: (made: File) => Promise<void> | void) => {
    const option = sizes?.options.find((item) => item.id === id)
    if (!option) return
    setFailure(null)
    setMaking(true)
    try {
      await handOut(await option.make())
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setFailure('That size could not be made. Try again.')
    } finally {
      setMaking(false)
    }
  }
  const shareFile = async (made: File) => navigator.share({ files: [made], title: shareTitle })

  const copyImage = async () => {
    setFailure(null)
    await clipboardImage.copyImage(file)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {canShare &&
          (otherSizes.length > 0 ? (
            <SplitButton
              label="Share"
              icon={<ShareOutlinedIcon fontSize="small" />}
              testId="share-main"
              onClick={() => void share()}
              items={otherSizes.map((item) => ({ id: `share-${item.id}`, label: `Share ${item.label}`, icon: <ShareOutlinedIcon fontSize="small" />, onClick: () => void withSize(item.id, shareFile) }))}
            />
          ) : (
            <Button size="compact" startIcon={<ShareOutlinedIcon />} onClick={() => void share()}>
              Share
            </Button>
          ))}
        {file && otherSizes.length > 0 ? (
          <SplitButton
            label="Download PNG"
            icon={<FileDownloadOutlinedIcon fontSize="small" />}
            testId="download-main"
            variant={canShare ? 'secondary' : 'primary'}
            onClick={() => downloadFile(file)}
            items={otherSizes.map((item) => ({ id: `download-${item.id}`, label: `Download ${item.label}`, icon: <FileDownloadOutlinedIcon fontSize="small" />, onClick: () => void withSize(item.id, (made) => downloadFile(made)) }))}
          />
        ) : (
          <Button size="compact" variant={canShare ? 'secondary' : 'primary'} startIcon={<FileDownloadOutlinedIcon />} disabled={!file} onClick={() => file && downloadFile(file)}>
            Download PNG
          </Button>
        )}
        {clipboardImage.canCopyImage && (
          <Button size="compact" variant="secondary" startIcon={<ContentCopyOutlinedIcon />} disabled={!file} onClick={() => void copyImage()}>
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
        {failure ?? (making ? 'Making that size…' : clipboardImage.message)}
      </Typography>
    </Box>
  )
}
