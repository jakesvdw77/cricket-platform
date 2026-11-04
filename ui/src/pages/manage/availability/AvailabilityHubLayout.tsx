import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { Box } from '@mui/material'
import { Button } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { PageCounters } from '../../../components/PageCounters'
import type { PageCounterItem } from '../../../components/PageCounters'
import { availabilitySummaryKey, getAvailabilitySummary, typeFilterFor } from '../../../api/availabilitySummaryApi'
import type { AvailabilitySummary, AvailabilitySummaryFilters } from '../../../api/availabilitySummaryApi'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { scopeFilterText } from '../../../utils/availabilityScope'
import { ViewTabsRow } from '../../../components/ViewTabsRow'
import { AddPollChooserDialog } from './AddPollChooserDialog'
import { useAvailabilityHubState } from './hubContext'
import { PlayersPanel } from './PlayersPanel'
import { PollsPanel } from './PollsPanel'
import type { PollsPanelKind } from './PollsPanel'
import type { PlayersPanelTab } from './PlayersPanel'

type HubView = 'polls' | 'players' | 'coverage'

// docs/specs/073-availability-hub.md: the views of the hub; docs/specs/074 adds Coverage (Match-Day Cover since the 083 follow-up).
// docs/specs/136: a real tab row (page-anatomy section 1), Title Case labels, no icons.
const VIEWS: { value: HubView; label: string; to: string }[] = [
  { value: 'polls', label: 'Polls', to: '/manage/availability' },
  { value: 'players', label: 'Players', to: '/manage/availability/players' },
  { value: 'coverage', label: 'Match-Day Cover', to: '/manage/availability/coverage' },
]

// The active view comes from the pathname: ending in /players is Players, /coverage is Coverage,
// anything else is Polls.
function activeView(pathname: string): HubView {
  const path = pathname.replace(/\/+$/, '')
  if (path.endsWith('/players')) return 'players'
  if (path.endsWith('/coverage')) return 'coverage'
  return 'polls'
}

// docs/specs/081: the Polls view counters, with the amber tone on the two that need attention.
// docs/specs/085 (G): all four are drill-downs that open a slide-in panel - "Open polls" (or "Polls shown" with Show
// closed on) and "Close in 48 hours" open the polls panel, the two players counters open the players panel. A counter
// at zero is a plain card (PageCounters' zero rule). The figures never change with a panel: the summary request does
// not carry them.
function counterItems(
  summary: AvailabilitySummary,
  showClosed: boolean,
  openPolls: (kind: PollsPanelKind) => void,
  openPlayers: (tab: PlayersPanelTab) => void,
): PageCounterItem[] {
  return [
    // With Show closed on the figure counts closed polls too, so it reads "Polls shown".
    {
      id: 'open-polls',
      value: summary.openPolls,
      label: showClosed ? 'Polls Shown' : 'Open Polls',
      kind: 'drill',
      hint: 'See polls',
      onSelect: () => openPolls('all'),
    },
    {
      id: 'players-responded',
      value: `${summary.playersResponded} / ${summary.playersInAudience}`,
      label: 'Players Responded',
      kind: 'drill',
      hint: 'See who',
      onSelect: () => openPlayers('responded'),
    },
    {
      id: 'players-still-to-answer',
      value: summary.playersStillToAnswer,
      label: 'Players Still To Answer',
      tone: summary.playersStillToAnswer > 0 ? 'warning' : 'default',
      kind: 'drill',
      hint: 'See who',
      onSelect: () => openPlayers('awaiting'),
    },
    {
      id: 'closing-soon',
      value: summary.closingSoon,
      label: 'Close In 48 Hours',
      tone: summary.closingSoon > 0 ? 'warning' : 'default',
      kind: 'drill',
      hint: 'See polls',
      onSelect: () => openPolls('closing-soon'),
    },
  ]
}

// docs/specs/073: the shared layout route of the Polls, Players and Coverage views - the "Availability" header,
// a Polls | Players | Match-day cover switch that is real navigation, and New poll on Polls only. Forwards the club id
// through its own Outlet context. docs/specs/083: it also owns the shared League/Section/Team filters and the
// default season (saved per club, mirrored in the address) and hands them to the three views through that context.
export default function AvailabilityHubLayout() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const location = useLocation()
  const { pathname } = location
  const [chooserOpen, setChooserOpen] = useState(false)
  const view = activeView(pathname)
  // docs/specs/085 (C8): the browser tab names the view; the visible page title stays "Availability".
  useDocumentTitle(`${VIEWS.find((entry) => entry.value === view)?.label ?? 'Polls'} · Availability`)
  const hub = useAvailabilityHubState(clubId, true, view !== 'coverage')

  // The counters belong to the Polls view only and describe exactly what its list shows: the shared filters,
  // the poll type toggles and Show closed. A failed request hides the row, the page still works.
  const summaryFilters: AvailabilitySummaryFilters = {
    leagueId: hub.filters.leagueId,
    sectionId: hub.filters.sectionId,
    teamId: hub.validTeamId,
    type: typeFilterFor(hub.showGroup, hub.showSquad),
    includeClosed: hub.showClosed,
    seasonId: hub.seasonId,
  }
  // The players panel: open/closed and its tab are local state, not in the address.
  const [panel, setPanel] = useState<{ open: boolean; tab: PlayersPanelTab }>({ open: false, tab: 'awaiting' })
  const [pollsPanel, setPollsPanel] = useState<{ open: boolean; kind: PollsPanelKind }>({ open: false, kind: 'all' })
  // Leaving Polls closes both panels, so coming back never shows one stale.
  useEffect(() => {
    if (view === 'polls') return
    setPanel((current) => (current.open ? { ...current, open: false } : current))
    setPollsPanel((current) => (current.open ? { ...current, open: false } : current))
  }, [view])
  const summaryQuery = useQuery({
    queryKey: availabilitySummaryKey(clubId ?? '', summaryFilters),
    queryFn: () => getAvailabilitySummary(clubId as string, summaryFilters),
    // Held until the teams and the season resolved, so the counters never go out unscoped first.
    enabled: Boolean(clubId) && view === 'polls' && !hub.teamsLoading && !hub.teamsError && !hub.seasonsLoading,
    retry: false,
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  // The caption is built from exactly the filters sent to the summary.
  const scope = scopeFilterText({
    sections: hub.sections,
    sectionId: summaryFilters.sectionId,
    leagues: hub.leagues,
    leagueId: summaryFilters.leagueId,
    teams: hub.teams,
    teamId: summaryFilters.teamId,
  })
  const showCounters = view === 'polls' && !hub.teamsError && !summaryQuery.isError && (summaryQuery.isPending || Boolean(summaryQuery.data))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <ManageScreenHeader
        title="Availability"
        action={
          <Button size="compact" onClick={() => setChooserOpen(true)} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Create New Poll
          </Button>
        }
      />

      {/* docs/specs/136: the views are link navigation, so a nav landmark with aria-current on the active tab. The active view's own
          action sits right-aligned on the same row (Jump To Today on Players; not on a phone, where the lists have no such button). */}
      <ViewTabsRow aria-label="Availability views" value={view} tabs={VIEWS.map((entry) => ({ value: entry.value, label: entry.label, to: entry.to }))} />

      {showCounters && (
        <PageCounters
          density="compact"
          items={
            summaryQuery.data
              ? counterItems(
                  summaryQuery.data,
                  hub.showClosed,
                  (kind) => setPollsPanel({ open: true, kind }),
                  (tab) => setPanel({ open: true, tab }),
                )
              : []
          }
          loading={summaryQuery.isPending}
        />
      )}

      {/* Independent of the counters row: a failed or pending summary refetch must not unmount an open panel. */}
      {view === 'polls' && !hub.teamsError && (
        <PlayersPanel
          open={panel.open}
          onClose={() => setPanel((current) => ({ ...current, open: false }))}
          clubId={clubId}
          tab={panel.tab}
          onTabChange={(tab) => setPanel((current) => ({ ...current, tab }))}
          // Exactly the summary's filters.
          filters={summaryFilters}
          counts={{ responded: summaryQuery.data?.playersResponded ?? 0, awaiting: summaryQuery.data?.playersStillToAnswer ?? 0 }}
          scope={scope}
        />
      )}

      {view === 'polls' && !hub.teamsError && (
        <PollsPanel
          open={pollsPanel.open}
          onClose={() => setPollsPanel((current) => ({ ...current, open: false }))}
          kind={pollsPanel.kind}
          rows={hub.pollRows}
          showClosed={hub.showClosed}
          scope={scope}
        />
      )}

      <AddPollChooserDialog open={chooserOpen} onClose={() => setChooserOpen(false)} sectionId={hub.filters.sectionId} />

      <Outlet context={hub} />
    </Box>
  )
}
