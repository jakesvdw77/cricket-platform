import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Alert, Box, CircularProgress, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { BrandIcon } from '../../../components/BrandIcon'
import { EmptyState, EmptyStateLink } from '../../../components/EmptyState'
import { ToolbarCard } from '../../../components/ToolbarCard'
import { useLocation, useNavigate } from 'react-router-dom'
import type { TeamSelectionMatch, TeamSelectionOverview } from '../../../api/teamSelectionApi'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { useTeamSelectionHub } from './hubContext'
import { matchesSearch } from './matchSearch'
import { sortMatchesByDate } from './sortMatches'
import { TeamSelectionFilterBar } from './TeamSelectionFilterBar'

export interface MatchesFrameProps {
  // Alerts or notices the view adds under the shared ones (write errors).
  notices?: ReactNode
  // The view's own toggles, after View Entire Season (a chip in the toolbar row, a switch in the phone sheet).
  extraControls?: (placement: 'row' | 'sheet') => ReactNode
  // Controls kept on every screen size at the right, above the content (the Previous / Next slot arrows).
  pinned?: ReactNode
  // Time Slots: the matches are sorted by date and the toolbar shows the Sort button (docs/specs/137).
  sortable?: boolean
  children: (matches: TeamSelectionMatch[], data: TeamSelectionOverview) => ReactNode
}

// docs/specs/093-team-selection-hub.md, revamped by docs/specs/137: what the Time Slots and Batting Order views share around their content -
// the flat toolbar card (the hub filters, View Entire Season, the view's own toggles), the loading / error / truncated / empty states
// and the search applied to the matches. No "Showing N" line.
export function MatchesFrame({ notices, extraControls, pinned, sortable = false, children }: MatchesFrameProps) {
  const { overview, showPast, search, sort } = useTeamSelectionHub()
  const navigate = useNavigate()
  const location = useLocation()
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'), { noSsr: true })
  const data = overview.data
  const term = search.trim().toLowerCase()
  const visible = useMemo(() => {
    const found = (data?.matches ?? []).filter((match) => matchesSearch(match, term))
    return sortable ? sortMatchesByDate(found, sort) : found
  }, [data, term, sortable, sort])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <ToolbarCard>
        {/* On a tablet or desktop the slot arrows sit at the right end of the toolbar row, saving a row of height (docs/specs/137). */}
        <TeamSelectionFilterBar extraControls={extraControls} sortable={sortable} viewControls={!phone ? pinned : undefined} />
      </ToolbarCard>
      {pinned && phone && <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>{pinned}</Box>}

      {overview.isPending && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress aria-label="Loading team selection" />
        </Box>
      )}
      {overview.isError && (
        <EmptyState title="Couldn't load team selection" description="Something went wrong loading the matches. Please try again." />
      )}
      {data?.truncated && <Alert severity="info">Only the first matches are shown. Narrow the filters to see the rest.</Alert>}
      {notices}

      {data && visible.length === 0 && (
        <EmptyState
          icon={<BrandIcon name="nav/upcoming-matches" size={48} />}
          title={term ? 'No matching matches' : showPast ? 'No matches' : 'No upcoming matches'}
          description={
            term
              ? 'No matches fit this search. Clear it to see more.'
              : 'Nothing to select a team for. Turn on View Entire Season to see earlier fixtures.'
          }
          action={
            term ? undefined : (
              <EmptyStateLink onClick={() => navigate(withReturnTo('/manage/fixtures/matches/new', currentOrigin(location), 'Team Selection'))}>Create New Match</EmptyStateLink>
            )
          }
        />
      )}
      {data && visible.length > 0 && children(visible, data)}
    </Box>
  )
}
