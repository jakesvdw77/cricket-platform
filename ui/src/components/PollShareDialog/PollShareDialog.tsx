import { useEffect, useState } from 'react'
import { Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import { Button } from '../Button'
import { Input } from '../Input'
import type { Match } from '../../api/matchApi'

export interface PollShareDialogProps {
  open: boolean
  onClose: () => void
  match: Match
  // The resolved display name of the side this poll is for (the caller already has this — either
  // a real Team's name or the match's own free-text side name).
  teamName: string
  pollId: string
}

// The match's own free-text side name, when set, is almost always the opponent for the side this
// poll belongs to (the polled side is nearly always the club's own real Team) — a display nicety,
// not authoritative business logic. Falls back to a generic label when both sides are real Teams,
// since Match itself carries no display name for a real-Team side (only its id).
function opponentLabel(match: Match, teamName: string): string {
  if (match.homeTeamName && match.homeTeamName !== teamName) {
    return match.homeTeamName
  }
  if (match.awayTeamName && match.awayTeamName !== teamName) {
    return match.awayTeamName
  }
  return 'the opposition'
}

function buildInviteText(match: Match, teamName: string, pollId: string): string {
  const link = `${window.location.origin}/poll/${pollId}`
  const matchDate = new Date(match.matchDate).toLocaleString()
  const lines = [
    `Hi ${teamName}!`,
    '',
    `Please let us know if you're available for our upcoming match against ${opponentLabel(match, teamName)}:`,
    '',
    `Date: ${matchDate}`,
  ]
  if (match.venue) {
    lines.push(`Venue: ${match.venue}`)
  }
  lines.push('', `Tap your name and set your status here: ${link}`, '', 'Thanks!')
  return lines.join('\n')
}

// docs/specs/032-match-availability-polls.md — mirrors the legacy Cricket Legend app's
// PollWhatsAppDialog.tsx shape (an editable, regenerable plain-text area embedding the poll's
// public link) for the *pattern* only, not its literal copy/branding (030's own precedent).
// Channel-agnostic: plain, copy-paste-into-any-chat text, not a real WhatsApp integration. The
// admin does the actual sharing themselves — no send/copy automation beyond a selectable/editable
// text field.
export function PollShareDialog({ open, onClose, match, teamName, pollId }: PollShareDialogProps) {
  const [text, setText] = useState('')

  // Regenerates fresh invite text every time the dialog opens, so a previous edit never leaks
  // into a later open — same reset-on-open pattern TeamSheetCommunicationDialog already uses.
  useEffect(() => {
    if (open) {
      setText(buildInviteText(match, teamName, pollId))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pollId])

  const handleRegenerate = () => {
    setText(buildInviteText(match, teamName, pollId))
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
        </Stack>
      </DialogContent>
      <DialogActions>
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
