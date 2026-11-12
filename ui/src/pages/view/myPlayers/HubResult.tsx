import { isAxiosError } from 'axios'
import { Alert, Box, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import StarIcon from '@mui/icons-material/Star'
import { Button } from '../../../components/Button'
import { useMyPlayer, useMyPlayerMatch } from '../../../api/myPlayersApi'
import { useMyPlayerResult } from '../../../api/meResultsApi'
import { HubMatchLinks } from './HubMatchLinks'
import type { MyResultDetail, MyResultInnings } from '../../../api/meResultsApi'
import { blackAlpha, creamAlpha } from '../../../brandTokens'
import { HUB, hubPageHeading } from './hubStyle'
import { HubGameCard } from './HubGameCard'
import { competitionText, economy, extrasLine, howOutWords, oversToBalls, resultBanner, resultDate } from './resultsFormat'

// docs/specs/145 (Hub Result page, results/:matchId): the header (both teams, date, league, venue, the result line and both scores as
// static compact figures), the held player's own card first, then the full scorecard of each innings with names (the player's own
// row highlighted), the awards. Read only; the footer's Back returns to the list with the same Season, Team and League. A result
// that is not shown in the Player Hub is a 404, shown as "This result is not available".
const panelSx = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, gap: 0.75, border: 1, borderColor: HUB.line, borderRadius: '4px', p: 1.5, bgcolor: blackAlpha(0.22) } as const
const sectionTitle = { fontFamily: HUB.display, fontWeight: 600, fontSize: 17, letterSpacing: '0.04em', textTransform: 'uppercase', color: HUB.sand } as const
const cellSx = { color: HUB.cream, borderColor: HUB.lineSoft, px: 0.75, py: 0.75, fontSize: 14, whiteSpace: 'nowrap' } as const
const headSx = { ...cellSx, color: HUB.muted, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' } as const
const mineSx = { bgcolor: alpha(HUB.gold, 0.18), boxShadow: `inset 3px 0 0 ${HUB.gold}` } as const

function Skeletons() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }} aria-busy="true" data-testid="hub-result-loading">
      <Skeleton variant="rounded" height={120} sx={{ bgcolor: creamAlpha(0.12) }} />
      <Skeleton variant="rounded" height={260} sx={{ bgcolor: creamAlpha(0.12) }} />
      <Skeleton variant="rounded" height={200} sx={{ bgcolor: creamAlpha(0.12) }} />
    </Box>
  )
}

function Figure({ name, score }: { name: string; score: string }) {
  return (
    <Box sx={{ flex: '1 1 150px', minWidth: 0, minHeight: 46, border: 1, borderColor: HUB.line, borderRadius: '6px', px: 1.5, py: 0.75, bgcolor: creamAlpha(0.07), display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', alignContent: 'center' }}>
      <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: HUB.muted, overflowWrap: 'anywhere' }}>{name}</Typography>
      <Typography component="span" sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 19, color: HUB.gold }}>{score || '-'}</Typography>
    </Box>
  )
}

function InningsCard({ innings, ballsPerOver }: { innings: MyResultInnings; ballsPerOver: number }) {
  return (
    <Box component="section" aria-label={`${innings.battingTeamName} Innings`} data-testid="hub-result-innings" sx={panelSx}>
      <Typography component="h3" sx={{ ...sectionTitle, overflowWrap: 'anywhere' }}>
        {innings.battingTeamName} · {innings.runs}/{innings.wickets} ({innings.overs} ov)
      </Typography>
      <Box sx={{ overflowX: 'auto', minWidth: 0, maxWidth: '100%' }}>
        <Table size="small" aria-label={`${innings.battingTeamName} Batting`} sx={{ minWidth: 300 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...headSx, width: '100%' }}>Batter</TableCell>
              {['R', 'B', '4s', '6s'].map((head) => <TableCell key={head} align="right" sx={headSx}>{head}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {innings.batting.map((batter) => (
              <TableRow key={`${batter.position}-${batter.name}`} data-mine={batter.mine} sx={batter.mine ? mineSx : undefined}>
                <TableCell sx={{ ...cellSx, whiteSpace: 'normal' }}>
                  <Typography component="span" sx={{ fontSize: 14, fontWeight: batter.mine ? 700 : 500, display: 'block' }}>{batter.name}</Typography>
                  <Typography component="span" sx={{ fontSize: 12, color: HUB.muted, display: 'block' }}>{howOutWords(batter.howOut, batter.bowler, batter.fielder)}</Typography>
                </TableCell>
                <TableCell align="right" sx={{ ...cellSx, fontWeight: 700 }}>{batter.runs}</TableCell>
                <TableCell align="right" sx={cellSx}>{batter.balls}</TableCell>
                <TableCell align="right" sx={cellSx}>{batter.fours}</TableCell>
                <TableCell align="right" sx={cellSx}>{batter.sixes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {innings.didNotBat.length > 0 && (
        <Typography sx={{ fontSize: 14, color: HUB.muted }}>
          Did not bat: {innings.didNotBat.join(', ')}
        </Typography>
      )}
      <Typography sx={{ fontSize: 14 }}>{extrasLine(innings)}</Typography>
      {innings.bowling.length > 0 && (
        <Box sx={{ overflowX: 'auto', mt: 0.5, minWidth: 0, maxWidth: '100%' }}>
          <Table size="small" aria-label={`${innings.battingTeamName} Bowling`} sx={{ minWidth: 300 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headSx, width: '100%' }}>Bowler</TableCell>
                {['O', 'M', 'R', 'W', 'Econ'].map((head) => <TableCell key={head} align="right" sx={headSx}>{head}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {innings.bowling.map((bowler) => {
                const value = economy(bowler.runs, oversToBalls(bowler.overs, ballsPerOver), ballsPerOver)
                return (
                  <TableRow key={bowler.name} data-mine={bowler.mine} sx={bowler.mine ? mineSx : undefined}>
                    <TableCell sx={{ ...cellSx, fontWeight: bowler.mine ? 700 : 500, whiteSpace: 'normal' }}>{bowler.name}</TableCell>
                    <TableCell align="right" sx={cellSx}>{bowler.overs}</TableCell>
                    <TableCell align="right" sx={cellSx}>{bowler.maidens}</TableCell>
                    <TableCell align="right" sx={cellSx}>{bowler.runs}</TableCell>
                    <TableCell align="right" sx={{ ...cellSx, fontWeight: 700 }}>{bowler.wickets}</TableCell>
                    <TableCell align="right" sx={cellSx}>{value === null ? '-' : value.toFixed(1)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  )
}

function Awards({ result }: { result: MyResultDetail }) {
  if (result.awards.length === 0) return null
  const side = (value?: 'HOME' | 'AWAY' | null) => (value === 'HOME' ? result.mine.homeName : value === 'AWAY' ? result.mine.awayName : null)
  return (
    <Box component="section" aria-label="Awards" data-testid="hub-result-awards" sx={panelSx}>
      <Typography component="h3" sx={sectionTitle}>Awards</Typography>
      {result.awards.map((award) => (
        <Typography key={`${award.type}-${award.side ?? ''}-${award.playerName}`} sx={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <StarIcon sx={{ fontSize: 16, color: HUB.gold }} aria-hidden />
          {award.type === 'PLAYER_OF_MATCH' ? 'Player Of The Match' : `Team Player Of The Match${side(award.side) ? `, ${side(award.side)}` : ''}`}: {award.playerName}
        </Typography>
      ))}
    </Box>
  )
}

export function HubResult({ playerKey, matchId }: { playerKey: string; matchId: string }) {
  const query = useMyPlayerResult(playerKey, matchId)
  const player = useMyPlayer(playerKey).data
  // The links come from the match read (the same cached one the match page uses); the result read carries none.
  const match = useMyPlayerMatch(playerKey, matchId).data
  const result = query.data

  if (query.isError) {
    const missing = isAxiosError(query.error) && query.error.response?.status === 404
    return missing ? (
      <Alert severity="info" data-testid="hub-result-missing">This result is not available</Alert>
    ) : (
      <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => query.refetch()}>Retry</Button>}>
        We could not load this result. Please try again.
      </Alert>
    )
  }
  if (!result) return <Skeletons />

  const { mine } = result
  const meta = [resultDate(mine.matchDate, true), competitionText(mine), result.venue].filter(Boolean).join(' · ')
  return (
    <Box data-testid="hub-result" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, gap: 1.5 }}>
      <Typography component="h2" sx={{ ...hubPageHeading, fontSize: 24, textTransform: 'none', overflowWrap: 'anywhere' }}>
        {mine.homeName} versus {mine.awayName}
      </Typography>
      <Typography sx={{ fontSize: 14, color: HUB.muted, overflowWrap: 'anywhere' }}>{meta}</Typography>
      <Typography data-testid="hub-result-line" sx={{ fontSize: 17, color: HUB.gold, fontWeight: 600 }}>{resultBanner(mine)}</Typography>
      <HubMatchLinks stream={match?.stream} liveScore={match?.liveScore} />
      <Box data-testid="hub-result-figures" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Figure name={mine.homeName} score={mine.homeScore} />
        <Figure name={mine.awayName} score={mine.awayScore} />
      </Box>

      <Typography component="h3" sx={sectionTitle}>{player?.firstName ? `${player.firstName}'s Game` : 'Their Game'}</Typography>
      <HubGameCard playerName={player?.firstName ?? 'This Player'} row={mine} />

      {result.innings.map((innings) => <InningsCard key={innings.sequence} innings={innings} ballsPerOver={mine.ballsPerOver} />)}
      <Awards result={result} />
    </Box>
  )
}
