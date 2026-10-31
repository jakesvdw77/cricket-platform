import { Box } from '@mui/material'
import { PageCounters } from '../../../components/PageCounters'
import type { PageCounterItem } from '../../../components/PageCounters'
import { useCountdown } from '../../../components/Countdown'
import type { MatchResultStatus } from '../../../api/matchResultApi'
import type { MatchPoll } from '../../../api/matchApi'
import type { FieldVerificationStatus } from '../../../api/playingAreaApi'
import { formatMatchDateTime } from '../availability/pollHelpers'
import { WeatherBadge } from '../../../components/WeatherBadge'
import type { WeatherSummary } from '../../../utils/weather/wmo'

export interface MatchKeyFiguresProps {
  matchDate: string
  venue: string | null
  // docs/specs/099: the field the match is played on. When set, the tile is the Field tile: it links to the field's page and
  // carries the verification flag. Without one (legacy text, or nothing) it stays the Venue tile as before.
  playingAreaId?: string | null
  playingAreaVerificationStatus?: FieldVerificationStatus | null
  // The league's name, or null for a standalone friendly; the season label caption goes with it.
  leagueName: string | null
  seasonLabel: string | null
  // false until the polls and coverage have loaded: the Poll tile then shows a dash rather than a wrong state.
  pollsReady: boolean
  polls: MatchPoll[]
  // The scheduled close of the one open squad poll, when exactly one open squad poll has it (group polls have none).
  pollClosesAt: string | null
  // docs/specs/100: the match's real result state; "Played" now means a published result.
  resultStatus?: MatchResultStatus | null
  // docs/specs/130: the field's page opens with the match page as its origin (docs/specs/127). Omitted, the card links to the plain path.
  fieldTo?: string
  // docs/specs/131: the forecast for the match day (within 7 days, a field with a usable place). Omitted or null shows nothing.
  weather?: WeatherSummary | null
}

const NOT_KNOWN = '–'

function fieldCaption(status: FieldVerificationStatus | null | undefined): string {
  if (status === 'UNVERIFIED') return 'Field · Unverified'
  if (status === 'REJECTED') return 'Field · Rejected'
  return 'Field'
}

function pollValue(polls: MatchPoll[]): string {
  if (polls.some((poll) => poll.open)) return 'Open'
  return polls.length > 0 ? 'Closed' : 'None'
}

function pollCaption(polls: MatchPoll[], closesAt: string | null): string {
  if (polls.some((poll) => poll.open) && closesAt) return `Closes ${formatMatchDateTime(closesAt)}`
  if (polls.length === 0) return 'No Poll Yet'
  return polls.length === 1 ? '1 Poll' : `${polls.length} Polls`
}

// docs/specs/089 (A), revamped by docs/specs/130: the four things a manager reads first on the match page - when it starts (with the
// live countdown, amber within 24 hours, "Played" once it has a published result), where, in which league and season, and the poll -
// as four static compact PageCounters cards (no icons, no lone button; Open Availability is in Manage Match). The Venue card is a
// link to the field's page when the match has a field.
export function MatchKeyFigures({ matchDate, venue, playingAreaId, playingAreaVerificationStatus, leagueName, seasonLabel, pollsReady, polls, pollClosesAt, resultStatus, fieldTo, weather }: MatchKeyFiguresProps) {
  const kickoff = useCountdown(matchDate)
  const started = kickoff.stage === 'expired'
  const played = resultStatus === 'PUBLISHED'
  const start = new Date(matchDate)
  const dateText = start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const timeText = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const startsCaption = played ? `Played · ${timeText}` : started ? `Awaiting Result · ${timeText}` : kickoff.text ? `${timeText} · in ${kickoff.text}` : timeText

  const counters: PageCounterItem[] = [
    {
      id: 'starts',
      testId: 'match-figure-starts',
      value: dateText,
      label: startsCaption,
      shortLabel: played ? 'Played' : started ? 'Awaiting Result' : timeText,
      tone: !started && kickoff.warn ? 'warning' : 'default',
    },
    {
      id: 'venue',
      testId: 'match-figure-venue',
      value: venue || 'TBC',
      label: playingAreaId ? fieldCaption(playingAreaVerificationStatus) : 'Venue',
      tone: playingAreaId && playingAreaVerificationStatus && playingAreaVerificationStatus !== 'VERIFIED' ? 'warning' : 'default',
      to: playingAreaId ? (fieldTo ?? `/manage/fixtures/fields/${playingAreaId}`) : undefined,
    },
    {
      id: 'league',
      testId: 'match-figure-league',
      value: leagueName || 'Friendly',
      label: leagueName ? ['League', seasonLabel].filter(Boolean).join(' · ') : (seasonLabel ?? 'No League'),
    },
    {
      id: 'poll',
      testId: 'match-figure-poll',
      value: pollsReady ? pollValue(polls) : NOT_KNOWN,
      label: pollsReady ? pollCaption(polls, pollClosesAt) : 'Poll',
    },
  ]
  return (
    <Box data-testid="match-key-figures">
      <PageCounters items={counters} density="compact" />
      {weather && !played && (
        <Box sx={{ mt: 1 }}>
          <WeatherBadge summary={weather} testId="match-figure-weather" />
        </Box>
      )}
    </Box>
  )
}
