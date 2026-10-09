import { Box } from '@mui/material'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import { KeyFigureTile } from '../../../components/KeyFigureTile'
import { useCountdown } from '../../../components/Countdown'
import type { MatchPoll } from '../../../api/matchApi'
import { formatMatchDateTime } from '../availability/pollHelpers'

export interface MatchKeyFiguresProps {
  matchDate: string
  venue: string | null
  // The league's name, or null for a standalone friendly; the season label caption goes with it.
  leagueName: string | null
  seasonLabel: string | null
  // false until the polls and coverage have loaded: the Poll tile then shows a dash rather than a wrong state.
  pollsReady: boolean
  polls: MatchPoll[]
  // The scheduled close of the one open squad poll, when exactly one open squad poll has it (group polls have none).
  pollClosesAt: string | null
}

const NOT_KNOWN = '–'

function pollValue(polls: MatchPoll[]): string {
  if (polls.some((poll) => poll.open)) return 'Open'
  return polls.length > 0 ? 'Closed' : 'None'
}

function pollCaption(polls: MatchPoll[], closesAt: string | null): string {
  if (polls.some((poll) => poll.open) && closesAt) return `Closes ${formatMatchDateTime(closesAt)}`
  if (polls.length === 0) return 'No poll yet'
  return polls.length === 1 ? '1 poll' : `${polls.length} polls`
}

// docs/specs/089 (A): the four things a manager reads first on the match page - when it starts (with the card's live
// countdown, amber within 24 hours, "Played" once it has started), where, in which league and season, and the poll.
export function MatchKeyFigures({ matchDate, venue, leagueName, seasonLabel, pollsReady, polls, pollClosesAt }: MatchKeyFiguresProps) {
  const kickoff = useCountdown(matchDate)
  const played = kickoff.stage === 'expired'
  const start = new Date(matchDate)
  const dateText = start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const timeText = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const startsCaption = played ? `Played · ${timeText}` : kickoff.text ? `${timeText} · in ${kickoff.text}` : timeText

  return (
    <Box
      data-testid="match-key-figures"
      sx={{ display: 'grid', gap: { xs: 1, md: 1.5 }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}
    >
      <KeyFigureTile
        testId="match-figure-starts"
        icon={<EventOutlinedIcon />}
        value={dateText}
        label={startsCaption}
        tone={!played && kickoff.warn ? 'warning' : 'neutral'}
        textValue
      />
      <KeyFigureTile testId="match-figure-venue" icon={<PlaceOutlinedIcon />} value={venue || 'TBC'} label="Venue" textValue />
      <KeyFigureTile
        testId="match-figure-league"
        icon={<EmojiEventsOutlinedIcon />}
        value={leagueName || 'Friendly'}
        label={leagueName ? ['League', seasonLabel].filter(Boolean).join(' · ') : (seasonLabel ?? 'No league')}
        textValue
      />
      <KeyFigureTile
        testId="match-figure-poll"
        icon={<EventAvailableOutlinedIcon />}
        value={pollsReady ? pollValue(polls) : NOT_KNOWN}
        label={pollsReady ? pollCaption(polls, pollClosesAt) : 'Poll'}
        textValue
      />
    </Box>
  )
}
