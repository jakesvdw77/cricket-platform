import { useState } from 'react'
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { ShareControlGroup, useEditableShareText } from '../ShareCore'
import { ShareFormatScreen, ShareFooterContext } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { WhatsAppPhonePreview } from '../ShareResultDialog/WhatsAppPhonePreview'
import { WhatsAppSendActions } from '../WhatsAppSendActions'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'

export interface InviteShareDialogProps {
  open: boolean
  onClose: () => void
  // The invite message, with or without emoji. Called on every render, so it must be cheap and pure.
  buildText: (emoji: boolean) => string
  // The poll's public link (Copy link).
  link: string
  clubName?: string | null
}

// docs/specs/136 (owner, 2026-11-04): the poll invite is one of the Message templates, built on the same share shell as the league, match
// and result dialogs (ShareFormatScreen, a WhatsApp phone preview with an editable message, WhatsAppSendActions). Used by the squad poll's
// PollShareDialog and the group poll's SectionAvailabilityShareDialog. Full screen on a phone; a card from sm.
export function InviteShareDialog({ open, onClose, buildText, link, clubName = null }: InviteShareDialogProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const [emoji, setEmoji] = useState(true)
  const [footer, setFooter] = useState<HTMLElement | null>(null)
  const clipboard = useCopyToClipboard()
  const generated = buildText(emoji)
  const { text, setText, edited, guard, confirmDialog } = useEditableShareText(generated)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={phone}
      fullWidth
      maxWidth={false}
      aria-labelledby="share-invite-title"
      PaperProps={{ sx: { width: { sm: '100%' }, maxWidth: { sm: 860 }, height: { sm: 'auto' }, maxHeight: { sm: '92vh' } } }}
    >
      <DialogTitle id="share-invite-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}>
        <Box component="span">Share Invite</Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pb: 2, overflowX: 'hidden' }}>
        <ShareFooterContext.Provider value={footer}>
          <ShareFormatScreen
            title="WhatsApp"
            controls={
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Send it in WhatsApp, or copy it into SMS, email or a team group chat. You choose who receives it and press send yourself.
                </Typography>
                <ShareControlGroup label="Message">
                  <CompactSwitch label="Emoji" checked={emoji} onChange={(next) => guard(() => setEmoji(next))} />
                  {edited && (
                    <Button size="compact" variant="ghost" startIcon={<RefreshOutlinedIcon />} onClick={() => setText(null)}>
                      Restore Original Text
                    </Button>
                  )}
                </ShareControlGroup>
              </>
            }
            preview={
              <SharePreviewStage ariaLabel="WhatsApp message" caption="You can edit the message in the preview.">
                <WhatsAppPhonePreview clubName={clubName} text={text} onTextChange={setText} attachImage={false} image={null} />
              </SharePreviewStage>
            }
            actions={
              <WhatsAppSendActions
                text={text}
                shareTitle="Availability"
                clipboard={clipboard}
                copyLabel="Copy Text"
                extraActions={
                  <Button size="compact" variant="secondary" startIcon={<LinkOutlinedIcon />} onClick={() => clipboard.copy(link, 'link')}>
                    {clipboard.copiedKey === 'link' ? 'Copied' : 'Copy Link'}
                  </Button>
                }
              />
            }
          />
        </ShareFooterContext.Provider>
      </DialogContent>
      <DialogActions sx={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 1, px: { xs: 2, sm: 3 }, pt: 1.5, pb: 'max(12px, env(safe-area-inset-bottom))', borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box ref={setFooter} data-testid="share-footer" sx={{ minWidth: 0, flex: 1 }} />
        <Button size="compact" variant="secondary" onClick={onClose} sx={{ flexShrink: 0 }}>
          Close
        </Button>
      </DialogActions>
      {confirmDialog}
    </Dialog>
  )
}
