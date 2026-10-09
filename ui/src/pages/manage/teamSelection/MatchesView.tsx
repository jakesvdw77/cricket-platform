import { useMemo, useState } from 'react'
import { Alert, Box } from '@mui/material'
import { CompactSwitch } from '../../../components/CompactSwitch'
import { ContentControlsLine } from '../../../components/ContentControlsLine'
import { EmptyState } from '../../../components/EmptyState'
import { PageCounters } from '../../../components/PageCounters'
import type { PageCounterItem } from '../../../components/PageCounters'
import type { TeamSelectionStatus } from '../../../api/teamSelectionApi'
import { useTeamSelectionHub } from './hubContext'
import { matchesSearch } from './matchSearch'
import { SelectionMatchesTable } from './SelectionMatchesTable'
import { TeamSelectionFilterBar } from './TeamSelectionFilterBar'
import { useAnnounceSide } from './useAnnounceSide'
import { STATUS_LABELS } from './selectionStatus'

// docs/specs/093-team-selection-hub.md: the quick filter behind the counters. null shows every match; each counter
// equals its filter, because the figures and the rows come from the same overview response.
type Focus = TeamSelectionStatus

const FOCUS_ORDER: Focus[] = ['NOT_STARTED', 'IN_PROGRESS', 'READY_TO_ANNOUNCE', 'ANNOUNCED']

// The Matches view: counters (quick filters), the shared filter bar, the content line and the zebra table.
export default function MatchesView() {
  const { clubId, overview, showPast, setShowPast, search } = useTeamSelectionHub()
  const [focus, setFocus] = useState<Focus | null>(null)
  const announce = useAnnounceSide(clubId as string)

  const data = overview.data
  const term = search.trim().toLowerCase()
  const visible = useMemo(
    () => (data?.matches ?? []).filter((match) => (focus === null || match.status === focus) && matchesSearch(match, term)),
    [data, focus, term],
  )

  if (overview.isError) {
    return <EmptyState title="Couldn't load team selection" description="Something went wrong loading the matches. Please try again." />
  }

  const counts = data?.counts
  const toggle = (next: Focus) => setFocus((current) => (current === next ? null : next))
  const countFor: Record<Focus, number | undefined> = {
    NOT_STARTED: counts?.notStarted,
    IN_PROGRESS: counts?.inProgress,
    READY_TO_ANNOUNCE: counts?.readyToAnnounce,
    ANNOUNCED: counts?.announced,
  }
  const counters: PageCounterItem[] = data
    ? [
        {
          id: 'shown',
          value: data.matches.length,
          label: showPast ? 'Matches shown' : 'Upcoming matches',
          shortLabel: showPast ? 'Shown' : 'Upcoming',
          kind: 'filter',
          active: focus === null,
          hint: 'Show all',
          onSelect: () => setFocus(null),
        },
        ...FOCUS_ORDER.map(
          (status): PageCounterItem => ({
            id: status.toLowerCase().replace(/_/g, '-'),
            value: countFor[status] ?? 0,
            label: STATUS_LABELS[status],
            tone: status === 'NOT_STARTED' && (countFor[status] ?? 0) > 0 ? 'warning' : 'default',
            kind: 'filter',
            active: focus === status,
            hint: 'Tap to filter',
            onSelect: () => toggle(status),
          }),
        ),
      ]
    : []

  const pastToggle = <CompactSwitch checked={showPast} onChange={setShowPast} label="Show past matches" />
  const total = visible.length
  const scope = `Showing ${total} ${showPast ? '' : 'upcoming '}${total === 1 ? 'match' : 'matches'}${focus ? ` · ${STATUS_LABELS[focus]}` : ''}`

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <PageCounters density="compact" items={counters} loading={overview.isPending} />

      <TeamSelectionFilterBar viewControls={pastToggle} />

      <ContentControlsLine scope={scope} controls={pastToggle} />

      {announce.errorAlert}

      {data?.truncated && (
        <Alert severity="info">Only the first matches are shown. Narrow the filters to see the rest.</Alert>
      )}

      {data && total > 0 && (
        <SelectionMatchesTable
          matches={visible}
          onAnnounce={announce.request}
          announcingSideId={announce.announcingSideId}
        />
      )}

      {data && total === 0 && (
        <EmptyState
          title={focus || term ? 'No matching matches' : showPast ? 'No matches' : 'No upcoming matches'}
          description={
            focus || term
              ? 'No matches fit these filters. Clear the quick filter or the search to see more.'
              : 'Nothing to select a team for. Turn on Show past matches to see earlier fixtures.'
          }
        />
      )}

      {announce.dialog}
    </Box>
  )
}
