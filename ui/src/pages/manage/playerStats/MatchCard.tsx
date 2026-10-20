import type { ReactNode } from 'react'
import { Box, Link as MuiLink, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import type { PlayerMatchRow } from '../../../api/playerStatsApi'
import { formatInstantDate } from '../../../utils/formatInstantDate'
import { NOT_ON_FILE } from '../../../utils/playerFormat'
import { resultViewTo } from '../results/resultListHelpers'
import {
  bowlingDetail,
  bowlingFigure,
  competitionLabel,
  fieldingText,
  hasNoScorecard,
  inningsLine,
  opponentLabel,
  openResultLabel,
  teamsLabel,
} from './matchesFormat'
import { AwardMarkers, CardLine, ResultBadge } from './matchParts'
import { cardSx } from './matchLayout'

const mutedText = (text: string) => (
  <Box component="span" sx={{ color: 'text.secondary' }}>
    {text}
  </Box>
)

// docs/specs/115-player-match-list.md: the phone card of one match. The whole card opens the result (a stretched link on the date),
// date and result badge on the first line, the opponent in bold with the team and competition under it, then up to three lines.
export function MatchCard({ row, backTo }: { row: PlayerMatchRow; backTo: string }) {
  const { batting, bowling, fielding } = row
  const innings = batting.innings ?? []

  let battingText: ReactNode = NOT_ON_FILE
  if (batting.status === 'BATTED') battingText = innings.length > 0 ? innings.map(inningsLine).join(' + ') : String(batting.runs ?? NOT_ON_FILE)
  else if (batting.status === 'DID_NOT_BAT') battingText = mutedText('Did not bat')

  let bowlingText: ReactNode = NOT_ON_FILE
  if (bowling.status === 'BOWLED') bowlingText = `${bowlingFigure(bowling)} · ${bowlingDetail(bowling, row.ballsPerOver)}`
  else if (bowling.status === 'DID_NOT_BOWL') bowlingText = mutedText('Did not bowl')

  const fieldingLine = (fielding.status === 'RECORDED' && fieldingText(fielding, true)) || NOT_ON_FILE

  return (
    <Box
      component="li"
      data-testid="match-card"
      sx={[
        cardSx,
        { '&:hover': { borderColor: 'primary.main' }, '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 } },
      ]}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 28 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
          <MuiLink
            component={RouterLink}
            to={resultViewTo(row.matchId)}
            state={{ backTo, backLabel: 'Matches' }}
            aria-label={openResultLabel(formatInstantDate(row.matchDate, true), row)}
            color="inherit"
            underline="none"
            sx={{ fontSize: '0.9375rem', fontWeight: 700, '&::after': { content: '""', position: 'absolute', inset: 0 }, '&:focus-visible': { outline: 'none' } }}
          >
            {formatInstantDate(row.matchDate)}
          </MuiLink>
          <AwardMarkers awards={row.awards} showText />
        </Box>
        <ResultBadge result={row.result} />
      </Box>
      <Box>
        <Typography component="div" sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
          {opponentLabel(row)}
        </Typography>
        <Typography component="div" sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.3 }}>
          {[teamsLabel(row), competitionLabel(row)].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      {hasNoScorecard(row) ? (
        <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>No scorecard captured</Typography>
      ) : (
        <>
          <CardLine label="Batting">{battingText}</CardLine>
          <CardLine label="Bowling">{bowlingText}</CardLine>
          <CardLine label="Fielding">{fieldingLine}</CardLine>
        </>
      )}
    </Box>
  )
}
