import { InviteShareDialog } from '../InviteShareDialog'
import type { SectionAvailabilityRound } from '../../api/sectionAvailabilityApi'
import { formatBracketLabel } from '../../utils/dayPart'
import { closeTimeLine } from '../../utils/pollShareText'

export interface SectionAvailabilityShareDialogProps {
  open: boolean
  onClose: () => void
  round: SectionAvailabilityRound
}

// WhatsApp-style: emojis (optional), *bold* for the title and the deadline, one line per slot of the round. The deadline line is left out
// when the round has no automatic close time.
function buildInviteText(round: SectionAvailabilityRound, emoji: boolean): string {
  const link = `${window.location.origin}/section-availability/${round.id}`
  const mark = (symbol: string) => (emoji ? `${symbol} ` : '')
  const lines = [`${mark('🏏')}*${round.description}*`, `${mark('📍')}${round.sectionName}`]
  for (const bracket of round.brackets) {
    lines.push(`${mark('📅')}${formatBracketLabel(bracket.windowDate, bracket.dayPart, ' · ')}`)
  }
  const closeLine = closeTimeLine(round.autoClose, round.scheduledCloseAt, emoji)
  if (closeLine) {
    lines.push(closeLine)
  }
  lines.push('', `${mark('👇')}Tap your name and set your status for each slot:`, link, '', `Thanks!${emoji ? ' 🙌' : ''}`)
  return lines.join('\n')
}

// docs/specs/063 Part A; since docs/specs/136 the dialog is the shared InviteShareDialog (the Message templates look), scoped to one
// SectionAvailabilityRound: one shared link per round, the round's own editable description as the title.
export function SectionAvailabilityShareDialog({ open, onClose, round }: SectionAvailabilityShareDialogProps) {
  return (
    <InviteShareDialog
      open={open}
      onClose={onClose}
      buildText={(emoji) => buildInviteText(round, emoji)}
      link={`${window.location.origin}/section-availability/${round.id}`}
    />
  )
}
