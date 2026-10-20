import { Box, Chip, Typography, useMediaQuery } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import { PlayerName } from '../../../components/PlayerName'
import { badgeSx } from '../../../components/RecordCard'
import type { LeaderboardBoardInfo, LeaderboardFilters, LeaderboardRow } from '../../../api/leaderboardApi'
import type { PersonName } from '../../../utils/playerDisplayName'
import { bodyRowSx, headerRowSx } from '../leagueEdit/leagueEditRowStyles'
import { BOARD_COLUMNS, figureText, matchLine, rankText, sampleLine, supportingLine, statsLink } from './leaderboardFormat'

// docs/specs/103-player-stats.md (The Leaderboards page, item 4): one zebra row of a board. Rank (equal ranks show the same
// number, a dash for the unranked group), the player, the big figure and a muted supporting line. The WHOLE row is a link to the
// player's stats page carrying the board's filters (decision 16). Body text is 14 px or more, the figure 20 px.

export function BoardHeaderRow({ board }: { board: LeaderboardBoardInfo }) {
  const theme = useTheme()
  const wide = useMediaQuery(theme.breakpoints.up('sm'), { noSsr: true })
  return (
    <Box sx={headerRowSx(BOARD_COLUMNS)} data-testid="board-header-row">
      <Box sx={{ textAlign: 'center' }}>Rank</Box>
      <Box>Player</Box>
      <Box sx={{ textAlign: 'right' }}>{board.figureLabel || 'Figure'}</Box>
      {wide && <Box sx={{ textAlign: 'right' }}>{board.minimumKind === 'NONE' ? 'Played' : 'Sample'}</Box>}
    </Box>
  )
}

export interface BoardRowProps {
  board: LeaderboardBoardInfo
  row: LeaderboardRow
  // everyone listed, so a first-name collision is tagged only when both players are on screen
  view: PersonName[]
  filters: LeaderboardFilters
}

export function BoardRow({ board, row, view, filters }: BoardRowProps) {
  const theme = useTheme()
  const wide = useMediaQuery(theme.breakpoints.up('sm'), { noSsr: true })
  const leader = row.rank === 1
  const supporting = sampleLine(row) ?? supportingLine(row)
  const detail = matchLine(row)
  const person = { firstName: row.firstName, lastName: row.lastName, id: row.playerId }
  const unranked = row.rank === null || row.rank === undefined

  return (
    <Box
      component={RouterLink}
      to={statsLink(row.playerId, filters)}
      data-testid="board-row"
      data-rank={unranked ? 'none' : row.rank}
      sx={[
        bodyRowSx(BOARD_COLUMNS),
        { py: 1, textDecoration: 'none', color: 'text.primary' },
        leader && { boxShadow: (t) => `inset 3px 0 0 ${t.palette.primary.main}` },
      ]}
    >
      <Box
        sx={{
          justifySelf: 'center',
          minWidth: 32,
          height: 32,
          lineHeight: '32px',
          textAlign: 'center',
          borderRadius: '50%',
          fontSize: '1rem',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: unranked ? 'text.secondary' : 'primary.dark',
          bgcolor: leader ? alpha(theme.palette.primary.main, 0.16) : 'transparent',
        }}
      >
        {rankText(row.rank)}
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 0.75, rowGap: 0.25 }}>
          <Typography component="span" sx={{ fontSize: '1rem', fontWeight: 600, overflowWrap: 'anywhere' }}>
            <PlayerName person={person} view={view} />
          </Typography>
          {!row.active && <Chip size="small" label="Inactive" sx={badgeSx('muted')} />}
          {row.smallSample && (
            <Chip
              size="small"
              label="Small sample"
              sx={{ height: 24, fontSize: '0.8125rem', fontWeight: 600, color: 'warning.dark', bgcolor: alpha(theme.palette.warning.main, 0.14) }}
            />
          )}
        </Box>
        {detail && (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
            {detail}
          </Typography>
        )}
        {!wide && (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
            {supporting}
          </Typography>
        )}
      </Box>

      <Typography
        component="span"
        sx={{ fontSize: '1.25rem', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: row.figure === null ? 'text.secondary' : 'text.primary' }}
      >
        {figureText(board.code, row.figure)}
      </Typography>

      {wide && (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', textAlign: 'right' }}>
          {supporting}
        </Typography>
      )}
    </Box>
  )
}
