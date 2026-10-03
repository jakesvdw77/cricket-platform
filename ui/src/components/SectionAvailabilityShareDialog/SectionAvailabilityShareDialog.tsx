import { useEffect, useState } from 'react'
import { Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import { Button } from '../Button'
import { Input } from '../Input'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import type { SectionAvailabilityRound } from '../../api/sectionAvailabilityApi'
import { formatBracketLabel } from '../../utils/dayPart'
import { closeTimeLine } from '../../utils/pollShareText'

export interface SectionAvailabilityShareDialogProps {
  open: boolean
  onClose: () => void
  round: SectionAvailabilityRound
}

// WhatsApp-style: emojis, *bold* for the title and the deadline, one line per slot of the round. The
// deadline line is left out when the round has no automatic close time.
function buildInviteText(round: SectionAvailabilityRound): string {
  const link = `${window.location.origin}/section-availability/${round.id}`
  const lines = [`🏏 *${round.description}*`, `📍 ${round.sectionName}`]
  for (const bracket of round.brackets) {
    lines.push(`📅 ${formatBracketLabel(bracket.windowDate, bracket.dayPart, ' · ')}`)
  }
  const closeLine = closeTimeLine(round.autoClose, round.scheduledCloseAt)
  if (closeLine) {
    lines.push(closeLine)
  }
  lines.push('', '👇 Tap your name and set your status for each slot:', link, '', 'Thanks! 🙌')
  return lines.join('\n')
}

// docs/specs/063-section-availability-and-flexible-squads.md Part A (fixture-group-selection
// revision) - mirrors PollShareDialog's own shape exactly (editable, regenerable plain text
// embedding one public link), scoped to a SectionAvailabilityRound instead of a
// MatchAvailabilityPoll. One shared link per admin-selected set of fixtures, covering however
// many brackets those matches resolve to, rather than one link per bracket. The round's own
// editable `description` is the title everywhere, including here, rather than a formatted date
// range. Channel-agnostic: plain, copy-paste-into-any-chat text, not a real send integration.
export function SectionAvailabilityShareDialog({ open, onClose, round }: SectionAvailabilityShareDialogProps) {
  const [text, setText] = useState('')
  const { copy, copiedKey, failed } = useCopyToClipboard()
  const link = `${window.location.origin}/section-availability/${round.id}`

  // Regenerates fresh invite text every time the dialog opens, so a previous edit never leaks into
  // a later open - same reset-on-open pattern PollShareDialog already uses.
  useEffect(() => {
    if (open) {
      setText(buildInviteText(round))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, round.id, round.autoClose, round.scheduledCloseAt])

  const handleRegenerate = () => {
    setText(buildInviteText(round))
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Share invite</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Copy this text into WhatsApp, SMS, email, or a team group chat - no automated send
            happens from here.
          </Typography>
          <Input
            label="Invite text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            multiline
            minRows={8}
          />
          {/* Polite live region announcing the copy outcome; visible text is the button label. */}
          <Typography variant="caption" color={failed ? 'error.main' : 'text.secondary'} role="status" aria-live="polite">
            {copiedKey === 'message' && 'Message copied.'}
            {copiedKey === 'link' && 'Link copied.'}
            {failed && "Couldn't copy automatically - select the text and copy it manually."}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2, '& > :not(:first-of-type)': { ml: 0 } }}>
        <Button startIcon={<ContentCopyOutlinedIcon />} onClick={() => copy(text, 'message')}>
          {copiedKey === 'message' ? 'Copied' : 'Copy message'}
        </Button>
        <Button variant="secondary" startIcon={<LinkOutlinedIcon />} onClick={() => copy(link, 'link')}>
          {copiedKey === 'link' ? 'Copied' : 'Copy link'}
        </Button>
        <Button variant="ghost" startIcon={<RefreshOutlinedIcon />} onClick={handleRegenerate}>
          Regenerate
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
