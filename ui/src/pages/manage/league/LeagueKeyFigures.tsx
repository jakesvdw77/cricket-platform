import { Box } from '@mui/material'
import { PageCounters } from '../../../components/PageCounters'
import type { PageCounterItem } from '../../../components/PageCounters'
import { ageReferenceWording } from '../../../utils/ageCutoff'
import type { AgeReference } from '../../../api/leagueApi'
import { useCountdown } from '../../../components/Countdown'

export interface LeagueKeyFiguresProps {
  // The teams of the season: the club's own entered teams plus the league's other teams.
  teamCount: number
  matchCount: number
  playedCount: number
  nextMatchDate: string | null
  maxPlayingXiSize: number
  minAge: number | null
  maxAge: number | null
  // The date ages are judged on, when known: the full sentence is the tooltip of an info icon after the Playing XI caption.
  ageReference?: AgeReference | null
}

const NOT_ON_FILE = '–'

// docs/specs/091 (C), calmer strip docs/specs/126: the four figures a manager reads first on the league page, for the chosen season - teams,
// matches played, the next match (with the card's live countdown, amber within 24 hours) and the Playing XI size with the age range -
// as four static compact PageCounters cards.
export function LeagueKeyFigures({ teamCount, matchCount, playedCount, nextMatchDate, maxPlayingXiSize, minAge, maxAge, ageReference }: LeagueKeyFiguresProps) {
  const next = useCountdown(nextMatchDate)
  const nextDate = nextMatchDate ? new Date(nextMatchDate) : null
  const hasAge = minAge != null || maxAge != null
  const ageCaption = hasAge ? `Playing XI · age ${minAge ?? 'any'}-${maxAge ?? 'any'}` : 'Playing XI'
  // The full sentence lives in the info icon's tooltip, not on a second line.
  const wording = hasAge && ageReference?.referenceDate ? ageReferenceWording(ageReference) : null

  const nextValue = nextDate ? nextDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : NOT_ON_FILE
  const nextTime = nextDate ? nextDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : null
  const nextWarn = Boolean(nextDate && next.warn && next.stage !== 'expired')
  const nextLabel = nextTime
    ? `Next match ${nextTime}${next.text ? ` \u00b7 in ${next.text}` : ''}`
    : matchCount === 0
      ? 'No matches scheduled yet'
      : 'No more matches this season'

  const items = {
    teams: teamCount > 0 ? String(teamCount) : NOT_ON_FILE,
    played: matchCount > 0 ? `${playedCount} of ${matchCount}` : NOT_ON_FILE,
  }

  // The Matches counter card (docs/standards/page-anatomy.md section 2): four STATIC compact counters, no icons, no FILTER tag.
  const counters: PageCounterItem[] = [
    { id: 'teams', testId: 'league-figure-teams', value: items.teams, label: 'Teams' },
    { id: 'played', testId: 'league-figure-played', value: items.played, label: 'Matches played' },
    {
      id: 'next',
      testId: 'league-figure-next',
      value: nextValue,
      label: nextLabel,
      shortLabel: nextTime ? `Next ${nextTime}` : undefined,
      tone: nextWarn ? 'warning' : 'default',
    },
    { id: 'xi', testId: 'league-figure-xi', value: String(maxPlayingXiSize), label: ageCaption, info: wording?.sentence },
  ]
  return (
    <Box data-testid="league-key-figures">
      <PageCounters items={counters} density="compact" />
    </Box>
  )
}
