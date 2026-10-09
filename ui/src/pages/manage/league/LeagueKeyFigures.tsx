import { Box } from '@mui/material'
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { KeyFigureTile } from '../../../components/KeyFigureTile'
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
}

const NOT_ON_FILE = '–'

// docs/specs/091 (C): the four figures a manager reads first on the league page, for the chosen season - teams, matches
// played, the next match (with the card's live countdown, amber within 24 hours) and the Playing XI size with the age range.
export function LeagueKeyFigures({ teamCount, matchCount, playedCount, nextMatchDate, maxPlayingXiSize, minAge, maxAge }: LeagueKeyFiguresProps) {
  const next = useCountdown(nextMatchDate)
  const nextDate = nextMatchDate ? new Date(nextMatchDate) : null
  const nextCaption = nextDate
    ? `Next · ${nextDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}${next.text ? ` · in ${next.text}` : ''}`
    : matchCount === 0
      ? 'No matches scheduled yet'
      : 'No more matches this season'
  const ageCaption = minAge != null || maxAge != null ? `Playing XI · age ${minAge ?? 'any'}–${maxAge ?? 'any'}` : 'Playing XI'

  return (
    <Box
      data-testid="league-key-figures"
      sx={{ display: 'grid', gap: { xs: 1, md: 1.5 }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}
    >
      <KeyFigureTile testId="league-figure-teams" icon={<GroupsOutlinedIcon />} value={teamCount > 0 ? String(teamCount) : NOT_ON_FILE} label="Teams this season" />
      <KeyFigureTile
        testId="league-figure-played"
        icon={<FlagOutlinedIcon />}
        value={matchCount > 0 ? `${playedCount} of ${matchCount}` : NOT_ON_FILE}
        label="Matches played"
        textValue
      />
      <KeyFigureTile
        testId="league-figure-next"
        icon={<EventOutlinedIcon />}
        value={
          nextDate
            ? nextDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
            : NOT_ON_FILE
        }
        label={nextCaption}
        tone={nextDate && next.warn && next.stage !== 'expired' ? 'warning' : 'neutral'}
        textValue
      />
      <KeyFigureTile testId="league-figure-xi" icon={minAge != null || maxAge != null ? <CakeOutlinedIcon /> : <SportsCricketOutlinedIcon />} value={String(maxPlayingXiSize)} label={ageCaption} />
    </Box>
  )
}
