import { useEffect, useState } from 'react'
import { Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import { Button } from '../Button'
import { Input } from '../Input'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import type { Match } from '../../api/matchApi'
import { closeTimeLine } from '../../utils/pollShareText'

// Only what the invite text reads - so a squad poll card can share without fetching the full Match.
export type PollShareMatch = Pick<Match, 'matchDate' | 'venue' | 'homeTeamName' | 'awayTeamName'>

export interface PollShareDialogProps {
  open: boolean
  onClose: () => void
  match: PollShareMatch
  // The resolved display name of the side this poll is for (the caller already has this — either
  // a real Team's name or the match's own free-text side name).
  teamName: string
  pollId: string
  // Optional: when the poll closes automatically, the invite highlights the close time. Callers
  // without it simply get no deadline line.
  autoClose?: boolean
  scheduledCloseAt?: string | null
}

// The match's own free-text side name, when set, is almost always the opponent for the side this
// poll belongs to (the polled side is nearly always the club's own real Team) — a display nicety,
// not authoritative business logic. Falls back to a generic label when both sides are real Teams,
// since Match itself carries no display name for a real-Team side (only its id).
function opponentLabel(match: PollShareMatch, teamName: string): string {
  if (match.homeTeamName && match.homeTeamName !== teamName) {
    return match.homeTeamName
  }
  if (match.awayTeamName && match.awayTeamName !== teamName) {
    return match.awayTeamName
  }
  return 'the opposition'
}

// WhatsApp-style: emojis, *bold* for the title and the deadline, short lines. The deadline line is
// left out when the poll has no automatic close time.
function buildInviteText(
  match: PollShareMatch,
  teamName: string,
  pollId: string,
  autoClose?: boolean,
  scheduledCloseAt?: string | null,
): string {
  const link = `${window.location.origin}/poll/${pollId}`
  const matchDate = new Date(match.matchDate).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const lines = [
    `🏏 *Availability: ${teamName} vs ${opponentLabel(match, teamName)}*`,
    `📅 ${matchDate}${match.venue ? ` · ${match.venue}` : ''}`,
  ]
  const closeLine = closeTimeLine(autoClose, scheduledCloseAt)
  if (closeLine) {
    lines.push(closeLine)
  }
  lines.push('', '👇 Tap your name and set your status:', link, '', 'Thanks! 🙌')
  return lines.join('\n')
}

// docs/specs/032-match-availability-polls.md — mirrors the legacy Cricket Legend app's
// PollWhatsAppDialog.tsx shape (an editable, regenerable plain-text area embedding the poll's
// public link) for the *pattern* only, not its literal copy/branding (030's own precedent).
// Channel-agnostic: plain, copy-paste-into-any-chat text, not a real WhatsApp integration. The
// admin does the actual sharing themselves — no send/copy automation beyond a selectable/editable
// text field.
export function PollShareDialog({ open, onClose, match, teamName, pollId, autoClose, scheduledCloseAt }: PollShareDialogProps) {
  const [text, setText] = useState('')
  const { copy, copiedKey, failed } = useCopyToClipboard()
  const link = `${window.location.origin}/poll/${pollId}`

  // Regenerates fresh invite text every time the dialog opens, so a previous edit never leaks
  // into a later open — same reset-on-open pattern TeamSheetCommunicationDialog already uses.
  useEffect(() => {
    if (open) {
      setText(buildInviteText(match, teamName, pollId, autoClose, scheduledCloseAt))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pollId, autoClose, scheduledCloseAt])

  const handleRegenerate = () => {
    setText(buildInviteText(match, teamName, pollId, autoClose, scheduledCloseAt))
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Share invite</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Copy this text into WhatsApp, SMS, email, or a team group chat — no automated send
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
