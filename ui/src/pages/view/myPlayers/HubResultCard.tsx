import { Box, ButtonBase, Typography } from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import { Link as RouterLink } from 'react-router-dom'
import type { MyResultRow } from '../../../api/meResultsApi'
import { OverBlocks, RunsMixBar } from '../../../components/ResultDrawings'
import { BRAND, blackAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'
import { bigSx, cardSx, kickerSx } from './resultCardStyle'
import {
  battingFigure,
  bowlingFigure,
  cardKind,
  competitionText,
  economyText,
  howOutWords,
  milestoneLabel,
  milestoneSentence,
  oversText,
  resultBanner,
  resultDate,
  resultPath,
  resultTone,
  storyLine,
  versusText,
} from './resultsFormat'
import type { Milestone } from './resultsFormat'

// docs/specs/145 (Player Hub Results): one card of the carousel, one idea each. Variants are chosen from the row: batting (the
// figure, balls, how out, a one-line story, the runs-mix bar), bowling (the figure, overs, economy, the over blocks) and did not
// bat (muted, catches); a milestone card stands apart. Tinted gold for a win, muted red for a loss, sand for a tie. Every card
// carries a small scope label and, except the last, a "Next: ..." button. The card opens the Hub Result page through a stretched
// link on its banner; the Next button sits above it.

const stretchedLink = {
  color: 'inherit',
  textDecoration: 'none',
  outline: 'none',
  '&::after': { content: '""', position: 'absolute', inset: 0 },
} as const

// The foot of every card: the scope label on the left, the Next button on the right (above the stretched link).
export function CardFoot({ scope, next }: { scope: string; next?: { label: string; onClick: () => void } }) {
  return (
    <Box sx={{ mt: 'auto', pt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, position: 'relative', zIndex: 1 }}>
      <Typography data-testid="result-scope-label" sx={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: HUB.muted }}>
        {scope}
      </Typography>
      {next && (
        <ButtonBase
          onClick={next.onClick}
          sx={{ minHeight: 44, px: 1, fontSize: 13, letterSpacing: '0.04em', color: HUB.muted, borderRadius: '8px', textAlign: 'right', '&:hover': { color: HUB.cream }, '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}
        >
          {next.label}
        </ButtonBase>
      )}
    </Box>
  )
}

function Score({ name, score, bold }: { name: string; score: string; bold?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontSize: 15, mt: 0.75 }}>
      <Typography component="span" sx={{ fontSize: 15, fontWeight: bold ? 600 : 400, overflowWrap: 'anywhere' }}>{name}</Typography>
      <Typography component="span" sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 20, whiteSpace: 'nowrap' }}>{score || '-'}</Typography>
    </Box>
  )
}

export interface HubResultCardProps {
  playerKey: string
  playerName: string
  row: MyResultRow
  scope: string
  // The query string (season, team, league) the result page carries so Back restores the list.
  scopeQuery?: string
  next?: { label: string; onClick: () => void }
  // The result page's own "Your game" card: no banner, no link, no Next.
  standalone?: boolean
}

export function HubResultCard({ playerKey, playerName, row, scope, scopeQuery, next, standalone }: HubResultCardProps) {
  const kind = cardKind(row)
  const tone = resultTone(row.result)
  const title = `${versusText(row)}, ${resultDate(row.matchDate)}`
  const star = row.awards.playerOfTheMatch > 0 ? 'Player Of The Match' : row.awards.teamPlayerOfTheMatch > 0 ? 'Team Player Of The Match' : null
  const kicker = [resultDate(row.matchDate), versusText(row), row.ourTeams.length === 1 ? row.ourTeams[0].teamName : null].filter(Boolean).join(' · ')
  const innings = row.batting.innings ?? []
  const last = innings[innings.length - 1]
  const howOut = last ? (last.notOut ? 'not out' : howOutWords(last.howOut)) : ''

  return (
    <Box component="article" data-testid="hub-result-card" data-kind={kind} data-tone={tone} sx={cardSx(tone)}>
      <Typography sx={{ ...kickerSx, ...(standalone ? { display: 'none' } : {}) }}>{kicker}</Typography>
      {!standalone && (
        <Box sx={{ borderRadius: '16px', p: '12px 14px', bgcolor: blackAlpha(0.28), border: `1px solid ${HUB.lineSoft}`, mt: 0.5 }}>
          <Typography
            component={RouterLink}
            to={resultPath(playerKey, row.matchId, scopeQuery)}
            aria-label={`Open the result: ${title}`}
            sx={{ ...stretchedLink, display: 'block', fontFamily: HUB.display, fontSize: 25, letterSpacing: '0.03em', textTransform: 'uppercase', lineHeight: 1.05, '&:focus-visible::after': { outline: `2px solid ${HUB.gold}`, outlineOffset: -2, borderRadius: '22px' } }}
          >
            {resultBanner(row)}
          </Typography>
          <Score name={row.homeName} score={row.homeScore} />
          <Score name={row.awayName} score={row.awayScore} />
          <Typography sx={{ fontSize: 13, color: HUB.muted, mt: 0.5 }}>{competitionText(row)}</Typography>
        </Box>
      )}
      <Typography sx={{ ...kickerSx, mt: 1.5 }}>
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
        <Box sx={{ flex: 1, display: 'grid', alignContent: 'center', justifyItems: 'center', textAlign: 'center', gap: 1, py: 2 }}>
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
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.25 }}>
            <Typography data-testid="result-figure" sx={{ ...bigSx, fontSize: 92 }}>{kind === 'batting' ? battingFigure(row) : bowlingFigure(row)}</Typography>
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
      {!standalone && <CardFoot scope={scope} next={next} />}
    </Box>
  )
}

// The milestone card: a medal, the headline and one sentence. It stands apart from the match cards and opens that match.
export function HubMilestoneCard({ playerKey, milestone, scope, scopeQuery, next }: { playerKey: string; milestone: Milestone; scope: string; scopeQuery?: string; next?: { label: string; onClick: () => void } }) {
  const label = milestoneLabel(milestone.kind)
  const number = milestone.kind === 'CENTURY' ? '100' : milestone.kind === 'FIFTY' ? '50' : '5'
  return (
    <Box component="article" data-testid="hub-milestone-card" sx={{ ...cardSx('win'), textAlign: 'center', alignItems: 'center' }}>
      <Typography sx={kickerSx}>Milestone · {resultDate(milestone.row.matchDate)}</Typography>
      <Box component="svg" viewBox="0 0 120 120" role="img" aria-label={label} sx={{ width: 120, height: 120, mt: 0.75 }}>
        <circle cx="60" cy="52" r="38" fill={BRAND.gold} />
        <circle cx="60" cy="52" r="30" fill="none" stroke={BRAND.ink} strokeWidth="3" opacity=".35" />
        <text x="60" y="64" textAnchor="middle" fontSize="34" fontWeight="700" fill={BRAND.ink} style={{ fontFamily: HUB.display }}>{number}</text>
        <path d="M40 86 L34 116 L60 104 L86 116 L80 86" fill="#c8363d" />
      </Box>
      <Typography
        component={RouterLink}
        to={resultPath(playerKey, milestone.row.matchId, scopeQuery)}
        sx={{ ...stretchedLink, ...bigSx, fontSize: 56, mt: 1, textTransform: 'uppercase', '&:focus-visible::after': { outline: `2px solid ${HUB.gold}`, outlineOffset: -2, borderRadius: '22px' } }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: 17, lineHeight: 1.35 }}>{milestoneSentence(milestone)}</Typography>
      <Typography sx={{ fontSize: 15, color: HUB.muted }}>{resultBanner(milestone.row)}.</Typography>
      <Box sx={{ width: '100%', mt: 'auto' }}>
        <CardFoot scope={scope} next={next} />
      </Box>
    </Box>
  )
}

