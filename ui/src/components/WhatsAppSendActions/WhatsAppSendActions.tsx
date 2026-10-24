import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import { Button } from '../Button'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { buildWhatsAppLink, buildWhatsAppWebLink, fitsWhatsAppLink } from '../../utils/whatsappLink'

export interface WhatsAppSendActionsProps {
  // The message exactly as shown in the editable box; links stay inside it.
  text: string
  // Optional file (the result image) shared together with the text through the native share sheet.
  file?: File
  shareTitle?: string
  // Key for the shared copy hook's feedback; default 'message'.
  copyKey?: string
  // Pass the dialog's own useCopyToClipboard() when it has other copy buttons (Copy link), so one
  // status region announces them all.
  clipboard?: ReturnType<typeof useCopyToClipboard>
  copyLabel?: string
  copyFailureText?: string
  disabled?: boolean
  // Called after every Copy message attempt (true when it worked).
  onCopyResult?: (ok: boolean) => void
  // Extra buttons shown after Copy text (for example Copy image and Download image), and their status text, announced in the
  // same status region.
  extraActions?: ReactNode
  extraStatus?: string | null
}

function canNativeShare(file?: File): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  // Text only: the native share sheet of a desktop browser drops the text and keeps just a link (seen sharing a poll from a Mac
  // to WhatsApp Desktop), so it is offered for text only on a touch device. Send in WhatsApp covers the desktop.
  if (!file) return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

// docs/specs/114-share-result.md "Send to WhatsApp": one-tap WhatsApp delivery for every WhatsApp
// text. A web page cannot choose the recipient or press send; the manager does that in WhatsApp.
export function WhatsAppSendActions({
  text,
  file,
  shareTitle,
  copyKey = 'message',
  clipboard,
  copyLabel = 'Copy message',
  copyFailureText = "Couldn't copy automatically - select the text and copy it manually.",
  disabled = false,
  onCopyResult,
  extraActions,
  extraStatus,
}: WhatsAppSendActionsProps) {
  const ownClipboard = useCopyToClipboard()
  const { copy, copiedKey, failed } = clipboard ?? ownClipboard
  const fits = fitsWhatsAppLink(text)
  const showShare = canNativeShare(file)
  const desktop = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && !window.matchMedia('(pointer: coarse)').matches

  const handleSend = () => {
    window.open(buildWhatsAppLink(text), '_blank', 'noopener')
  }

  const handleSendWeb = () => {
    window.open(buildWhatsAppWebLink(text), '_blank', 'noopener')
  }

  const handleShare = async () => {
    try {
      await navigator.share({ text, ...(shareTitle ? { title: shareTitle } : {}), ...(file ? { files: [file] } : {}) })
    } catch (error) {
      // The manager closing the share sheet is not an error.
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }

  const handleCopy = async () => {
    const ok = await copy(text, copyKey)
    onCopyResult?.(ok)
  }

  return (
    <Stack spacing={1}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {fits && (
          <Button size="compact" startIcon={<WhatsAppIcon />} onClick={handleSend} disabled={disabled}>
            Send in WhatsApp
          </Button>
        )}
        {fits && desktop && (
          <Button size="compact" variant="secondary" startIcon={<WhatsAppIcon />} onClick={handleSendWeb} disabled={disabled}>
            WhatsApp Web
          </Button>
        )}
        {showShare && (
          <Button size="compact" variant="secondary" startIcon={<ShareOutlinedIcon />} onClick={handleShare} disabled={disabled}>
            Share
          </Button>
        )}
        <Button
          size="compact"
          variant={fits ? 'secondary' : 'primary'}
          startIcon={<ContentCopyOutlinedIcon />}
          onClick={handleCopy}
          disabled={disabled}
        >
          {copiedKey === copyKey ? 'Copied' : copyLabel}
        </Button>
        {extraActions}
      </Box>
      {!fits && (
        <Typography variant="body2" color="text.secondary">
          This message is too long to send straight to WhatsApp. Copy it and paste it into WhatsApp.
        </Typography>
      )}
      {/* Polite live region announcing the copy outcome; visible text is the button label. */}
      <Typography variant="caption" color={failed ? 'error.main' : 'text.secondary'} role="status" aria-live="polite">
        {copiedKey === copyKey && 'Message copied.'}
        {copiedKey === 'link' && 'Link copied.'}
        {failed && copyFailureText}
        {extraStatus}
      </Typography>
    </Stack>
  )
}
