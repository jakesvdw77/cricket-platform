import type { ReactNode } from 'react'
import { Alert, Box, Skeleton, Typography } from '@mui/material'
import { Button } from '../../../../../components/Button'
import { visuallyHiddenSx } from '../../../../../components/StatsCards'
import { useMyAwards } from '../../../../../api/meStatsApi'
import type { MyAwardsCategory } from '../../../../../api/meStatsApi'
import type { MyResultScope } from '../../../../../api/meResultsApi'
import { creamAlpha } from '../../../../../brandTokens'
import { HUB } from '../../hubStyle'
import { bigSx, cardSx } from '../../resultCardStyle'
import { awardLine } from './boardsFormat'

// docs/specs/147 section 6 and Open question 2: the Awards tab shows the category leaders of the club's Awards categories only for a season that has
// ended; while it is running (or rankings are not shared) it shows the server's sentence instead ("Awards are revealed when the season ends.").
// Names are full names, inside the Hub only. A tie gives joint leaders. No Share, Copy or Download. Every figure is the server's.
export interface BoardAwardsProps {
  playerKey: string
  scope: MyResultScope
  // Shown instead of the categories when no result is counted for the scope.
  empty: ReactNode
  enabled: boolean
}

function Category({ category }: { category: MyAwardsCategory }) {
  const joint = category.leaders.length > 1
  return (
    <Box component="li" data-testid={`hub-award-${category.board.code}`} sx={{ ...cardSx('neutral'), p: 2, borderRadius: '18px', gap: 1, listStyle: 'none' }}>
      <Typography component="h3" sx={{ fontFamily: HUB.display, fontSize: 14, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: HUB.gold, m: 0 }}>
        {category.board.label}
      </Typography>
      {joint && <Typography sx={{ fontSize: 13, color: HUB.muted }}>Joint leaders</Typography>}
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
        {category.leaders.map((leader, index) => (
          <Box
            component="li"
            key={`${leader.firstName}-${leader.lastName}-${index}`}
            aria-current={leader.mine ? 'true' : undefined}
            sx={{ display: 'grid', gap: '2px', pl: 1.25, borderLeft: `4px solid ${leader.mine ? HUB.gold : 'transparent'}` }}
          >
            <Typography sx={{ ...bigSx, fontSize: 26, lineHeight: 1, color: HUB.cream, overflowWrap: 'anywhere' }}>
              {leader.firstName} {leader.lastName}
              {leader.mine && <Box component="span" sx={visuallyHiddenSx}> (This player)</Box>}
            </Typography>
            <Typography sx={{ fontSize: 14, color: HUB.muted }}>{awardLine(category.board, leader)}</Typography>
            {leader.smallSample && <Typography sx={{ fontSize: 12, color: HUB.muted }}>Small sample</Typography>}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export function BoardAwards({ playerKey, scope, empty, enabled }: BoardAwardsProps) {
  const query = useMyAwards(playerKey, scope, enabled)
  const awards = query.data

  if (query.isError && !awards) {
    return (
      <Alert
        severity="error"
        action={
          <Button variant="secondary" size="compact" onClick={() => void query.refetch()}>
            Retry
          </Button>
        }
      >
        We could not load the awards. Please try again.
      </Alert>
    )
  }
  if (!awards) {
    return (
      <Box aria-busy="true" data-testid="hub-boards-awards-loading" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fit, minmax(280px, 1fr))' } }}>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} variant="rounded" height={120} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '18px' }} />
        ))}
      </Box>
    )
  }
  if (!awards.revealed) {
    return (
      <Box data-testid="hub-boards-awards-held" sx={{ ...cardSx('neutral'), p: 2.5, gap: 1 }}>
        <Typography component="h2" sx={{ ...bigSx, fontSize: 30, color: HUB.gold }}>
          Awards
        </Typography>
        <Typography sx={{ fontSize: 16 }}>{awards.message ?? 'Awards are revealed when the season ends.'}</Typography>
        {awards.seasonEndDate && (
          <Typography sx={{ fontSize: 14, color: HUB.muted }}>
            The season ends on {new Date(awards.seasonEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </Typography>
        )}
      </Box>
    )
  }
  if (awards.basis.resultsCounted === 0) return <>{empty}</>
  const withLeaders = awards.categories.filter((category) => category.leaders.length > 0)
  if (withLeaders.length === 0 && awards.omitted.length === 0) {
    return (
      <Typography data-testid="hub-boards-awards-none" sx={{ py: 3, textAlign: 'center', color: HUB.muted }}>
        No awards to show for this scope yet.
      </Typography>
    )
  }
  return (
    <Box data-testid="hub-boards-awards" sx={{ display: 'grid', gap: 1.5, minWidth: 0 }}>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fit, minmax(280px, 1fr))' } }}>
        {withLeaders.map((category) => (
          <Category key={category.board.code} category={category} />
        ))}
      </Box>
      {awards.omitted.length > 0 && (
        <Box component="ul" data-testid="hub-boards-awards-omitted" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
          {awards.omitted.map((entry) => (
            <Typography component="li" key={entry.board.code} sx={{ fontSize: 14, color: HUB.muted }}>
              {entry.board.label}: {entry.reason || 'nobody qualified yet'}
            </Typography>
          ))}
        </Box>
      )}
      <Typography sx={{ fontSize: 13, color: HUB.muted }}>
        Based on {awards.basis.resultsCounted} result{awards.basis.resultsCounted === 1 ? '' : 's'}. Averages and economy need {awards.minimums.innings} innings or {awards.minimums.overs} overs.
      </Typography>
    </Box>
  )
}
