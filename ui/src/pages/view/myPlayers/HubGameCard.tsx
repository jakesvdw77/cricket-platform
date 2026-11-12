import { Box, Typography } from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import type { MyResultRow } from '../../../api/meResultsApi'
import { OverBlocks, RunsMixBar } from '../../../components/ResultDrawings'
import { HUB } from './hubStyle'
import { bigSx, cardSx, kickerSx } from './resultCardStyle'
import { battingFigure, bowlingFigure, cardKind, economyText, howOutWords, oversText, resultTone, storyLine } from './resultsFormat'

// docs/specs/145: the player's own game on the Hub Result page ("<First name>'s Game"): the big figure, the one-line story and the
// drawing (runs mix or over blocks), or the did-not-bat card. The result list uses the result-first HubResultCard instead.
export function HubGameCard({ playerName, row }: { playerName: string; row: MyResultRow }) {
  const kind = cardKind(row)
  const tone = resultTone(row.result)
  const star = row.awards.playerOfTheMatch > 0 ? 'Player Of The Match' : row.awards.teamPlayerOfTheMatch > 0 ? 'Team Player Of The Match' : null
  const innings = row.batting.innings ?? []
  const last = innings[innings.length - 1]
  const howOut = last ? (last.notOut ? 'not out' : howOutWords(last.howOut)) : ''

  return (
    <Box component="article" data-testid="hub-game-card" data-kind={kind} data-tone={tone} sx={cardSx(tone)}>
      <Typography sx={kickerSx}>
        {playerName}
        {kind === 'bowling' ? ' · Bowling' : ''}
        {star && (
          <Box component="span" sx={{ ml: 1, color: HUB.gold, display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
            <StarIcon sx={{ fontSize: 16 }} aria-hidden />
            {star}
          </Box>
        )}
      </Typography>

      {kind === 'noBat' ? (
        <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', alignContent: 'center', justifyItems: 'center', textAlign: 'center', gap: 1, py: 2 }}>
          <Typography sx={{ ...bigSx, fontSize: 52, color: HUB.muted }}>{row.batting.status === 'DID_NOT_BAT' ? 'Did Not Bat' : 'No Card'}</Typography>
          <Typography sx={{ fontSize: 17, lineHeight: 1.35, maxWidth: 270 }}>{storyLine(row)}</Typography>
          {row.fielding.catches > 0 && (
            <Typography component="span" data-testid="result-catches" sx={{ fontFamily: HUB.display, fontSize: 26, color: HUB.cream }}>
              {row.fielding.catches} {row.fielding.catches === 1 ? 'Catch' : 'Catches'}
            </Typography>
          )}
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: 1.25, minWidth: 0 }}>
            <Typography data-testid="result-figure" sx={{ ...bigSx, fontSize: { xs: 72, sm: 92 } }}>{kind === 'batting' ? battingFigure(row) : bowlingFigure(row)}</Typography>
            <Typography component="div" sx={{ color: HUB.muted, fontSize: 15, pb: 1 }}>
              {kind === 'batting' ? (
                <>
                  {row.batting.ballsFaced > 0 ? `off ${row.batting.ballsFaced} balls` : ''}
                  <br />
                  {howOut}
                </>
              ) : (
                <>
                  in {oversText(row.bowling.balls, row.ballsPerOver)}
                  <br />
                  {economyText(row)}
                </>
              )}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 17, lineHeight: 1.35 }}>{storyLine(row)}</Typography>
          <Box sx={{ mt: 1 }}>
            {kind === 'batting' ? (
              <RunsMixBar runs={row.batting.runs} fours={row.batting.fours} sixes={row.batting.sixes} />
            ) : (
              <OverBlocks balls={row.bowling.balls} ballsPerOver={row.ballsPerOver} wickets={row.bowling.wickets} maidens={row.bowling.maidens} />
            )}
          </Box>
        </>
      )}
    </Box>
  )
}
