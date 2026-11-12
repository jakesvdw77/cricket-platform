import { Box, Typography } from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import { Link as RouterLink } from 'react-router-dom'
import type { MyResultRow } from '../../../api/meResultsApi'
import { HUB } from './hubStyle'
import { cardSx, kickerSx } from './resultCardStyle'
import { competitionText, ourTeamsText, playerStripText, resultBanner, resultDate, resultPath, resultTone, versusText } from './resultsFormat'

// docs/specs/145 decision 11 (round 5): the result leads. The headline is the match (the result line, both scores, the league and
// team); the player's own contribution is a slim strip at the foot. Tinted gold for a win, muted red for a loss, sand for a tie.
// The whole card is one stretched link to the Hub Result page, carrying the filters so Back restores them. The copy names the player
// by first name, never "you".

const stretchedLink = {
  color: 'inherit',
  textDecoration: 'none',
  outline: 'none',
  '&::after': { content: '""', position: 'absolute', inset: 0 },
} as const

function Score({ name, score }: { name: string; score: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontSize: 15 }}>
      <Typography component="span" noWrap sx={{ fontSize: 15, minWidth: 0 }}>{name}</Typography>
      <Typography component="span" sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 21, whiteSpace: 'nowrap', lineHeight: 1.2 }}>{score || '-'}</Typography>
    </Box>
  )
}

export interface HubResultCardProps {
  playerKey: string
  playerName: string
  row: MyResultRow
  // The query string (season, league, team, competition) the result page carries so Back restores the list.
  scopeQuery?: string
  // The large banner at the top of the page.
  latest?: boolean
}

export function HubResultCard({ playerKey, playerName, row, scopeQuery, latest }: HubResultCardProps) {
  const tone = resultTone(row.result)
  const versus = versusText(row)
  const date = resultDate(row.matchDate)
  const star = row.awards.playerOfTheMatch > 0 ? 'Player of the match' : row.awards.teamPlayerOfTheMatch > 0 ? 'Team player of the match' : null
  const kicker = [latest ? 'Latest Result' : null, date, versus].filter(Boolean).join(' · ')
  const league = [competitionText(row), ourTeamsText(row)].filter(Boolean).join(' · ')

  const match = (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        component={RouterLink}
        to={resultPath(playerKey, row.matchId, scopeQuery)}
        aria-label={`Open the result: ${versus}, ${date}`}
        sx={{
          ...stretchedLink,
          display: 'block',
          fontFamily: HUB.display,
          fontSize: latest ? { xs: 28, md: 36 } : 26,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          lineHeight: 1.05,
          overflowWrap: 'anywhere',
          '&:focus-visible::after': { outline: `2px solid ${HUB.gold}`, outlineOffset: -2, borderRadius: '20px' },
        }}
      >
        {resultBanner(row)}
      </Typography>
      <Box sx={{ display: 'grid', gap: 0.25, mt: 1 }}>
        <Score name={row.homeName} score={row.homeScore} />
        <Score name={row.awayName} score={row.awayScore} />
      </Box>
      <Typography sx={{ fontSize: 12, color: HUB.muted, mt: 0.75 }}>{league}</Typography>
    </Box>
  )

  const strip = (
    <Box data-testid="result-player-strip" sx={{ borderTop: latest ? { xs: `1px solid ${HUB.lineSoft}`, md: 0 } : `1px solid ${HUB.lineSoft}`, pt: 1.25, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', fontSize: 14, mt: latest ? undefined : 'auto' }}>
      <Typography component="span" sx={{ fontSize: 14, color: HUB.sand }}>{playerStripText(row, playerName)}</Typography>
      {star && (
        <Box component="span" sx={{ color: HUB.gold, display: 'inline-flex', alignItems: 'center', gap: 0.25, fontSize: 13 }}>
          <StarIcon sx={{ fontSize: 16 }} aria-hidden />
          {star}
        </Box>
      )}
    </Box>
  )

  return (
    <Box component="article" data-testid={latest ? 'hub-result-latest' : 'hub-result-card'} data-tone={tone} sx={{ ...cardSx(tone), p: 2, gap: 1.5, borderRadius: '20px' }}>
      <Typography sx={{ ...kickerSx, fontSize: 14 }}>{kicker}</Typography>
      {latest ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.3fr) minmax(0, 1fr)' }, gap: 1.5, alignItems: 'end' }}>
          {match}
          {strip}
        </Box>
      ) : (
        <>
          {match}
          {strip}
        </>
      )}
    </Box>
  )
}
