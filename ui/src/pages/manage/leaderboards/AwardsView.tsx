import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { EmptyState, EmptyStateLink } from '../../../components/EmptyState'
import { InfoCard } from '../../../components/InfoCard'
import { IntegerField } from '../../../components/IntegerField'
import { PlayerName } from '../../../components/PlayerName'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useAwardsView } from '../../../api/leaderboardApi'
import type { AwardsCategory, AwardsOmission, LeaderboardBoardInfo, LeaderboardFilters } from '../../../api/leaderboardApi'
import { CategoryChooser } from './CategoryChooser'
import { awardLine, figureText } from './leaderboardFormat'
import { Button } from '../../../components/Button'

export interface AwardsViewProps {
  clubId: string
  filters: LeaderboardFilters
  hasFilters: boolean
  onClearFilters: () => void
  catalogue: LeaderboardBoardInfo[]
  // docs/specs/140 and the page-anatomy checklist: the page's ONE flat toolbar card. The view hands it the controls that belong to it (the two minimums,
  // Reset and Choose Categories), which sit before the Full name | Initials toggle.
  renderToolbar: (controls: ReactNode) => ReactNode
  enabled: boolean
}

// docs/specs/103-player-stats.md (Awards view, decisions 10, 11, 18 and the Awards mockup): the end-of-season sheet. A title
// block naming the scope, the two minimums (pre-filled with the values the server used, Reset to default), one card per category
// with joint winners together, a quiet amber note for a category nobody qualified for, and Choose categories. On screen only:
// PDF and text output are deferred. The minimums are per visit: the page remounts this view when the filters change.
export function AwardsView({ clubId, filters, hasFilters, onClearFilters, catalogue, renderToolbar, enabled }: AwardsViewProps) {
  // null = "the server's default" (the field shows the value the server used)
  const [innings, setInnings] = useState<number | null>(null)
  const [overs, setOvers] = useState<number | null>(null)
  const appliedInnings = useDebouncedValue(innings, 400)
  const appliedOvers = useDebouncedValue(overs, 400)
  const query = useAwardsView(clubId, filters, appliedInnings, appliedOvers, enabled)
  const awards = query.data

  const view = useMemo(
    () => (awards?.categories ?? []).flatMap((category) => category.leaders.map((leader) => ({ firstName: leader.firstName, lastName: leader.lastName, id: leader.playerId }))),
    [awards],
  )

  const customised = innings !== null || overs !== null
  const shownInnings = innings ?? awards?.minimums.innings ?? null
  const shownOvers = overs ?? awards?.minimums.overs ?? null

  const withWinners = (awards?.categories ?? []).filter((category) => category.leaders.length > 0)
  // Nobody qualified: named in `omitted` with the reason (a category that came back with no leaders is treated the same).
  const omitted: AwardsOmission[] = [
    ...(awards?.categories ?? []).filter((category) => category.leaders.length === 0).map((category) => ({ board: category.board, reason: '' })),
    ...(awards?.omitted ?? []),
  ]

  let body
  if (query.isError && !awards) {
    body = (
      <EmptyState
        icon={<ErrorOutlineIcon color="error" />}
        title="Could not load the awards"
        description="Check your connection and try again."
        action={
          <Button size="compact" variant="secondary" onClick={() => query.refetch()}>Try Again</Button>
        }
      />
    )
  } else if (!awards) {
    body = (
      <Typography aria-busy="true" sx={{ fontSize: '0.9375rem', color: 'text.secondary' }}>
        Loading the awards...
      </Typography>
    )
  } else if (awards.basis.resultsCounted === 0) {
    body = (
      <EmptyState
        title="No published results match these filters"
        description="Publish a result, or widen the filters."
        action={
          hasFilters ? <EmptyStateLink onClick={onClearFilters}>Clear Filters</EmptyStateLink> : undefined
        }
      />
    )
  } else if (withWinners.length === 0 && omitted.length === 0) {
    body = <EmptyState title="No categories to show" description="Use Choose Categories to pick what the awards sheet shows." />
  } else {
    body = (
      <Box data-testid="award-categories" sx={{ display: 'grid', gap: { xs: 1.75, md: 2 }, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, alignItems: 'stretch' }}>
        {withWinners.map((category: AwardsCategory) => {
          const joint = category.leaders.length > 1
          const first = category.leaders[0]
          return (
            <InfoCard flat key={category.board.code} fieldSize="large" title={category.board.label} icon={<EmojiEventsOutlinedIcon />} testId={`award-${category.board.code}`}>
              <Box>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {category.leaders.map((leader, index) => (
                    <span key={leader.playerId}>
                      {index > 0 && ', '}
                      <PlayerName person={{ firstName: leader.firstName, lastName: leader.lastName, id: leader.playerId }} view={view} />
                    </span>
                  ))}
                </Typography>
                <Typography sx={{ fontSize: '0.9375rem', color: 'text.secondary', mt: 0.25 }}>
                  {joint ? `Joint winners · ${figureText(category.board.code, first.figure)}` : awardLine(category.board, first)}
                </Typography>
              </Box>
            </InfoCard>
          )
        })}
        {omitted.map((entry) => (
          <InfoCard flat key={entry.board.code} fieldSize="large" tone="warning" title={entry.board.label} icon={<ErrorOutlineIcon />} testId={`award-none-${entry.board.code}`}>
            <Typography sx={{ fontSize: '0.9375rem' }}>{entry.reason || 'Nobody qualified for this category.'}</Typography>
          </InfoCard>
        ))}
      </Box>
    )
  }

  // The minimums are small labelled number cells in the toolbar; the server's default is their tooltip (no hint line of its own).
  const defaultHint = awards ? `Default ${awards.minimums.defaultInnings} and ${awards.minimums.defaultOvers} for these filters. Applies to Batting average and Economy rate.` : undefined
  const controls = (
    <>
      <Box title={defaultHint} data-testid="awards-minimums" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 13, fontWeight: 600 }}>
          Min. Innings
          <IntegerField variant="cell" label="Minimum innings" ariaLabel="Minimum innings" value={shownInnings} onChange={setInnings} max={999} maxLength={3} width={52} />
        </Box>
        <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 13, fontWeight: 600 }}>
          Min. Overs
          <IntegerField variant="cell" label="Minimum overs" ariaLabel="Minimum overs" value={shownOvers} onChange={setOvers} max={999} maxLength={3} width={52} />
        </Box>
        {customised && (
          <Button size="compact" variant="ghost" onClick={() => { setInnings(null); setOvers(null) }}>
            Reset To Default
          </Button>
        )}
      </Box>
      <CategoryChooser clubId={clubId} catalogue={catalogue} />
    </>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      {renderToolbar(controls)}
      {body}
    </Box>
  )
}
