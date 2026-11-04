import { InviteShareDialog } from '../InviteShareDialog'
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
  emoji = true,
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
    `${emoji ? '🏏 ' : ''}*Availability: ${teamName} vs ${opponentLabel(match, teamName)}*`,
    `${emoji ? '📅 ' : ''}${matchDate}${match.venue ? ` · ${match.venue}` : ''}`,
  ]
  const closeLine = closeTimeLine(autoClose, scheduledCloseAt, emoji)
  if (closeLine) {
    lines.push(closeLine)
  }
  lines.push('', `${emoji ? '👇 ' : ''}Tap your name and set your status:`, link, '', `Thanks!${emoji ? ' 🙌' : ''}`)
  return lines.join('\n')
}

// docs/specs/032-match-availability-polls.md; since docs/specs/136 the dialog is the shared InviteShareDialog (the Message templates look:
// a WhatsApp phone preview with an editable message, an Emoji switch, Send in WhatsApp, Copy Text and Copy Link). Channel-agnostic text:
// the admin does the actual sharing themselves.
export function PollShareDialog({ open, onClose, match, teamName, pollId, autoClose, scheduledCloseAt }: PollShareDialogProps) {
  return (
    <InviteShareDialog
      open={open}
      onClose={onClose}
      buildText={(emoji) => buildInviteText(match, teamName, pollId, autoClose, scheduledCloseAt, emoji)}
      link={`${window.location.origin}/poll/${pollId}`}
    />
  )
}
