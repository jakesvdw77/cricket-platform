import { Box, Link as MuiLink, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import type { PlayerMatchRow } from '../../../api/playerStatsApi'
import { formatInstantDate } from '../../../utils/formatInstantDate'
import { NOT_ON_FILE } from '../../../utils/playerFormat'
import { zebraTint } from '../../../utils/zebraTint'
import { hoverTint } from '../leagueEdit/leagueEditRowStyles'
import { resultViewTo } from '../results/resultListHelpers'
import {
  ballsText,
  bowlingDetail,
  bowlingFigure,
  competitionLabel,
  fieldingText,
  hasNoScorecard,
  howOutWord,
  opponentLabel,
  openResultLabel,
  runsText,
  teamsLabel,
} from './matchesFormat'
import { AwardMarkers, ResultBadge } from './matchParts'
import { matchGridSx, muted, subSx } from './matchLayout'

const cellSx = { fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums', px: 0.75, py: 0.5, minWidth: 0 } as const
const dashCell = <Box component="span" sx={muted}>{NOT_ON_FILE}</Box>

export function MatchRow({ row, backTo }: { row: PlayerMatchRow; backTo: string }) {
  const { batting, bowling, fielding } = row
  const innings = batting.innings ?? []
  const noCard = hasNoScorecard(row)
  const several = innings.length > 1

  return (
    <Box
      role="row"
      data-testid="match-row"
      sx={[
        matchGridSx,
        {
          position: 'relative',
          minHeight: 40,
          color: 'text.primary',
          bgcolor: 'background.paper',
          '&:nth-of-type(odd)': { bgcolor: zebraTint },
          '&:hover': { bgcolor: hoverTint },
          '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
        },
      ]}
    >
      <Box role="rowheader" sx={cellSx}>
        {/* The whole row is the link: this anchor's ::after covers the position: relative row. */}
        <MuiLink
          component={RouterLink}
          to={resultViewTo(row.matchId)}
          state={{ backTo, backLabel: 'Matches' }}
          aria-label={openResultLabel(formatInstantDate(row.matchDate, true), row)}
          color="inherit"
          underline="none"
          sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 }, '&:focus-visible': { outline: 'none' } }}
        >
          {formatInstantDate(row.matchDate)}
        </MuiLink>
      </Box>
      <Box role="cell" sx={cellSx}>
        <Typography component="div" sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
          {opponentLabel(row)}
        </Typography>
        <Typography component="div" sx={subSx}>
          {teamsLabel(row)}
        </Typography>
      </Box>
      <Box role="cell" sx={cellSx}>
        {competitionLabel(row)}
      </Box>
      <Box role="cell" sx={cellSx}>
        <ResultBadge result={row.result} />
      </Box>

      {noCard ? (
        <Box role="cell" aria-colspan={5} sx={{ ...cellSx, ...muted, gridColumn: '5 / 10' }}>
          No scorecard captured
        </Box>
      ) : (
        <>
          {batting.status === 'BATTED' ? (
            <>
              <Box role="cell" sx={{ ...cellSx, textAlign: 'right' }}>
                {several ? (
                  <>
                    <b>{batting.runs ?? NOT_ON_FILE}</b>
                    <Box sx={subSx}>{innings.length} innings</Box>
                  </>
                ) : (
                  <b>{innings[0] ? runsText(innings[0]) : (batting.runs ?? NOT_ON_FILE)}</b>
                )}
              </Box>
              <Box role="cell" sx={{ ...cellSx, textAlign: 'right' }}>
                {ballsText(innings, batting.ballsFaced)}
              </Box>
              <Box role="cell" sx={cellSx}>
                {innings.length === 0
                  ? dashCell
                  : innings.map((entry, index) => (
                      <div key={index}>{howOutWord(entry.howOut) || NOT_ON_FILE}</div>
                    ))}
              </Box>
            </>
          ) : batting.status === 'DID_NOT_BAT' ? (
            <Box role="cell" aria-colspan={3} sx={{ ...cellSx, ...muted, gridColumn: '5 / 8' }}>
              Did not bat
            </Box>
          ) : (
            <>
              <Box role="cell" sx={{ ...cellSx, textAlign: 'right' }}>{dashCell}</Box>
              <Box role="cell" sx={{ ...cellSx, textAlign: 'right' }}>{dashCell}</Box>
              <Box role="cell" sx={cellSx}>{dashCell}</Box>
            </>
          )}

          <Box role="cell" sx={cellSx}>
            {bowling.status === 'BOWLED' ? (
              <>
                <b>{bowlingFigure(bowling)}</b>
                <Box sx={subSx}>{bowlingDetail(bowling, row.ballsPerOver)}</Box>
              </>
            ) : bowling.status === 'DID_NOT_BOWL' ? (
              <Box component="span" sx={muted}>Did not bowl</Box>
            ) : (
              dashCell
            )}
          </Box>
          <Box role="cell" sx={cellSx}>
            {(fielding.status === 'RECORDED' && fieldingText(fielding)) || dashCell}
          </Box>
        </>
      )}
      <Box role="cell" sx={cellSx}>
        <AwardMarkers awards={row.awards} />
      </Box>
    </Box>
  )
}
