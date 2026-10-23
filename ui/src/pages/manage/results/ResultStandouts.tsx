import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Chip, Typography } from '@mui/material'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import StarIcon from '@mui/icons-material/Star'
import type { Match } from '../../../api/matchApi'
import { getScorecard, resultKeys } from '../../../api/matchResultApi'
import type { FieldingEntry, ResultSide } from '../../../api/matchResultApi'
import { PlayerName } from '../../../components/PlayerName'
import { scorecardPersonName } from '../../../utils/playerDisplayName'
import type { OwnSides } from '../../../utils/resultLine'
import { playerRowKey } from '../../../utils/scorecardPrefill'
import { featuredOf } from './ResultScorecard'
import { fieldingCredits } from './scorecardView'

const DASH = '–'
const CHIP_FONT_SIZE = '0.8125rem'
const num = (value: number | null | undefined) => (value === null || value === undefined ? DASH : value)

// The last block of the Details card: our sides' standouts (star chips) and the team's player of the match. Reads the
// scorecard the same way ResultScorecard does (one cached query). Renders nothing when there is nothing to show.
export function ResultStandouts({
  clubId,
  match,
  ours,
  names,
}: {
  clubId: string
  match: Match
  ours: OwnSides
  names: { home: string; away: string }
}) {
  const { data: scorecard } = useQuery({ queryKey: resultKeys.scorecard(clubId, match.id), queryFn: () => getScorecard(clubId, match.id) })
  const players = useMemo(() => scorecard?.players ?? [], [scorecard])
  const view = useMemo(() => players.map(scorecardPersonName), [players])
  if (!scorecard) return null

  const byKey = new Map(players.map((player) => [playerRowKey(player), player]))
  const playerOf = (entry: { resultPlayerId?: string | null; playerClientKey?: string | null }) => byKey.get((entry.resultPlayerId ?? entry.playerClientKey) as string)
  const nameOf = (entry: { resultPlayerId?: string | null; playerClientKey?: string | null }) => {
    const player = playerOf(entry)
    return player ? <PlayerName person={scorecardPersonName(player)} view={view} /> : DASH
  }
  const other = (side: ResultSide): ResultSide => (side === 'HOME' ? 'AWAY' : 'HOME')
  const both = ours.home && ours.away

  const blocks = (['HOME', 'AWAY'] as const)
    .filter((side) => (side === 'HOME' ? ours.home : ours.away))
    .map((side) => {
      const batted = scorecard.batting
        .filter((entry) => (playerOf(entry)?.side ?? entry.battingSide) === side && entry.howOut !== 'DID_NOT_BAT')
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
      const bowling = scorecard.bowling
        .filter((entry) => (playerOf(entry)?.side ?? other(entry.battingSide)) === side)
        .sort((a, b) => (a.bowlingOrder ?? 999) - (b.bowlingOrder ?? 999))
      const fielding = scorecard.fielding.filter((entry) => (playerOf(entry)?.side ?? other(entry.battingSide)) === side)
      const chips: ReactNode[] = [
        ...batted.filter(featuredOf).map((entry) => (
          <span key={`b${entry.id ?? entry.position}`}>
            {nameOf(entry)} {num(entry.runs)} ({num(entry.balls)})
          </span>
        )),
        ...bowling.filter(featuredOf).map((entry) => (
          <span key={`w${entry.id ?? entry.bowlingOrder}`}>
            {nameOf(entry)} {num(entry.wickets)}/{num(entry.runs)}
          </span>
        )),
        ...fielding.filter(featuredOf).map((entry: FieldingEntry) => (
          <span key={`f${entry.id ?? entry.resultPlayerId}`}>
            {nameOf(entry)} {fieldingCredits(entry)}
          </span>
        )),
      ]
      const award = scorecard.awards.find((candidate) => candidate.awardType === 'TEAM_PLAYER_OF_MATCH' && candidate.side === side)
      const awardLabel = award ? (playerOf(award) ? nameOf(award) : (award.displayName ?? award.playerName ?? DASH)) : null
      return { side, chips, awardLabel }
    })
    .filter((block) => block.chips.length > 0 || block.awardLabel)

  if (blocks.length === 0) return null
  return (
    <Box data-testid="result-standouts" sx={{ gridColumn: '1 / -1', borderTop: 1, borderColor: 'divider', pt: 1.25, mt: 0.25 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
        Standouts
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {blocks.map(({ side, chips, awardLabel }) => (
          <Box key={side} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {chips.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }} data-testid="scorecard-standouts">
                {chips.map((node, index) => (
                  <Chip key={index} size="small" icon={<StarIcon />} label={node} sx={{ height: 24, fontSize: CHIP_FONT_SIZE, '& .MuiChip-icon': { color: 'warning.main', fontSize: 16 } }} />
                ))}
              </Box>
            )}
            {awardLabel && (
              <Chip
                size="small"
                icon={<EmojiEventsOutlinedIcon />}
                color="primary"
                variant="outlined"
                data-testid="scorecard-team-award"
                sx={{ height: 24, fontSize: CHIP_FONT_SIZE, '& .MuiChip-icon': { fontSize: 16 } }}
                label={<>Team player of the match{both ? ` (${names[side === 'HOME' ? 'home' : 'away']})` : ''}: {awardLabel}</>}
              />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
