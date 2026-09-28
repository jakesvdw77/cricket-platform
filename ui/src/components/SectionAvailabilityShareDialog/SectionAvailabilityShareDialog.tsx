import { useEffect, useState } from 'react'
import { Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import { Button } from '../Button'
import { Input } from '../Input'
import type { SectionAvailabilityRound } from '../../api/sectionAvailabilityApi'

export interface SectionAvailabilityShareDialogProps {
  open: boolean
  onClose: () => void
  round: SectionAvailabilityRound
}

function buildInviteText(round: SectionAvailabilityRound): string {
  const link = `${window.location.origin}/section-availability/${round.id}`
  const lines = [
    `Hi ${round.sectionName}!`,
    '',
    `Please let us know if you're available - ${round.description}:`,
    '',
    `Tap your name and set your status here: ${link}`,
    '',
    'Thanks!',
  ]
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

  // Regenerates fresh invite text every time the dialog opens, so a previous edit never leaks into
  // a later open - same reset-on-open pattern PollShareDialog already uses.
  useEffect(() => {
    if (open) {
      setText(buildInviteText(round))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, round.id])

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
