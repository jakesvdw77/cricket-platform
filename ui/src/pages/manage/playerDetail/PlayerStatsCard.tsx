import { Link as RouterLink } from 'react-router-dom'
import { Box, Button as MuiButton, Skeleton, Stack, Typography } from '@mui/material'
import EqualizerOutlinedIcon from '@mui/icons-material/EqualizerOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { InfoCard } from '../../../components/InfoCard'
import type { InfoCardChip } from '../../../components/InfoCard'
import { FormStrip } from '../../../components/FormStrip'
import { usePlayerStats } from '../../../api/playerStatsApi'
import { battingFormItems, bowlingFormItems, decimals, resultsPhrase } from '../playerStats/statsFormat'
import { compactButtonSx } from '../../../components/Button'

export interface PlayerStatsCardProps {
  clubId: string
  playerId: string
  // the Bats / Bowls / Wicketkeeper chips, drawn first so they show while the figures load or fail
  chips: InfoCardChip[]
}

// docs/specs/103-player-stats.md: the Player page's merged Cricket card (decision 24): the Bats / Bowls / Wicketkeeper chips, then, fed by GET .../players/{playerId}/stats with
// no filters (career), six headline figures, the two recent-form strips and the View full breakdown button. Loading shows a
// skeleton; a failed read shows the figures as dashes with a quiet Try again, never an error page for a card. Every
// figure is the server's; a figure that rests on a card nobody captured is a dash, not a zero.
export function PlayerStatsCard({ clubId, playerId, chips }: PlayerStatsCardProps) {
  const statsQuery = usePlayerStats(clubId, playerId)
  const stats = statsQuery.data

  const button = (
    <MuiButton
      component={RouterLink}
      to={`/manage/players/${playerId}/stats`}
      variant="outlined"
      startIcon={<EqualizerOutlinedIcon fontSize="small" />}
      size="small"
      sx={{ ...compactButtonSx, width: { xs: '100%', md: 'auto' } }}
    >
      View full breakdown
    </MuiButton>
  )

  if (statsQuery.isPending) {
    return (
      <InfoCard title="Cricket" icon={<SportsCricketOutlinedIcon />} chips={chips} chipsFirst testId="player-stats-card" actions={button}>
        <Stack spacing={1} aria-busy="true" aria-label="Loading statistics">
          <Skeleton variant="rounded" height={14} width="80%" />
          <Skeleton variant="rounded" height={14} width="60%" />
        </Stack>
      </InfoCard>
    )
  }

  const hasBatting = Boolean(stats && stats.basis.resultsWithBattingCard > 0)
  const hasBowling = Boolean(stats && stats.basis.resultsWithBowlingCard > 0)
  const matches = stats ? stats.basis.matchesCounted : null
  const fields = [
    { label: 'Matches', value: matches === null ? null : String(matches), emphasis: 'primary' as const },
    { label: 'Runs', value: stats && hasBatting ? String(stats.batting.runs) : null, emphasis: 'primary' as const },
    { label: 'Batting avg', value: stats && hasBatting ? decimals(stats.batting.average, 2) : null, emphasis: 'primary' as const },
    { label: 'Strike rate', value: stats && hasBatting ? decimals(stats.batting.strikeRate, 2) : null, emphasis: 'primary' as const },
    { label: 'Wickets', value: stats && hasBowling ? String(stats.bowling.wickets) : null, emphasis: 'success' as const },
    { label: 'Economy', value: stats && hasBowling ? decimals(stats.bowling.economy, 2) : null, emphasis: 'primary' as const },
  ]

  let basis: string
  if (!stats) basis = "The statistics couldn't be loaded."
  else if (stats.basis.matchesCounted === 0) {
    basis = 'No published results with this player on the team list yet. Figures appear once a result is published.'
  } else {
    basis = `Based on ${resultsPhrase(stats.basis.matchesCounted)} with this player on the team list: ${stats.basis.resultsWithBattingCard} with a batting card, ${stats.basis.resultsWithBowlingCard} with a bowling card.`
  }

  return (
    <InfoCard title="Cricket" icon={<SportsCricketOutlinedIcon />} chips={chips} chipsFirst fieldSize="large" columns={3} fields={fields} testId="player-stats-card" actions={button}>
      {stats && stats.form.batting.length > 0 && <FormStrip title="Batting, last 5 innings" items={battingFormItems(stats.form.batting)} />}
      {stats && stats.form.bowling.length > 0 && <FormStrip title="Bowling, last 5 spells" items={bowlingFormItems(stats.form.bowling)} />}
      <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0, fontSize: '0.8125rem', lineHeight: 1.4 }}>
          {basis}{' '}
          {!stats && (
            <MuiButton variant="text" size="small" onClick={() => statsQuery.refetch()} sx={{ ...compactButtonSx, px: 1, verticalAlign: 'middle', textTransform: 'none' }}>
              Try again
            </MuiButton>
          )}
        </Typography>
      </Box>
    </InfoCard>
  )
}
