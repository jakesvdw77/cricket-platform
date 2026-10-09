import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Alert, Box, CircularProgress } from '@mui/material'
import { CompactSwitch } from '../../../components/CompactSwitch'
import { ContentControlsLine } from '../../../components/ContentControlsLine'
import { EmptyState } from '../../../components/EmptyState'
import type { TeamSelectionMatch, TeamSelectionOverview } from '../../../api/teamSelectionApi'
import { useTeamSelectionHub } from './hubContext'
import { matchesSearch } from './matchSearch'
import { TeamSelectionFilterBar } from './TeamSelectionFilterBar'

export interface MatchesFrameProps {
  // Alerts or notices the view adds under the shared ones (write errors).
  notices?: ReactNode
  // The view's own switches, shown beside Show past matches (and in the Filters sheet on a phone).
  controls?: ReactNode
  children: (matches: TeamSelectionMatch[], data: TeamSelectionOverview) => ReactNode
}

// docs/specs/093-team-selection-hub.md: what the Time slots and Batting order views share around their content - the
// hub filter bar, Show past, the loading / error / truncated / empty states, and the search applied to the matches.
export function MatchesFrame({ notices, controls, children }: MatchesFrameProps) {
  const { overview, showPast, setShowPast, search } = useTeamSelectionHub()
  const data = overview.data
  const term = search.trim().toLowerCase()
  const visible = useMemo(() => (data?.matches ?? []).filter((match) => matchesSearch(match, term)), [data, term])

  const pastToggle = (
    <>
      <CompactSwitch checked={showPast} onChange={setShowPast} label="Show past matches" />
      {controls}
    </>
  )
  const scope = data ? `Showing ${visible.length} ${showPast ? '' : 'upcoming '}${visible.length === 1 ? 'match' : 'matches'}` : ''

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TeamSelectionFilterBar viewControls={pastToggle} />
      <ContentControlsLine scope={scope} controls={pastToggle} />

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
          title={term ? 'No matching matches' : showPast ? 'No matches' : 'No upcoming matches'}
          description={
            term
              ? 'No matches fit this search. Clear it to see more.'
              : 'Nothing to select a team for. Turn on Show past matches to see earlier fixtures.'
          }
        />
      )}
      {data && visible.length > 0 && children(visible, data)}
    </Box>
  )
}
