import { useState } from 'react'
import { Box, Dialog, DialogContent, DialogTitle, Skeleton, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { PlayerAgentActions } from '../../../components/PlayerAgentActions'
import { CompactSwitch } from '../../../components/CompactSwitch'
import { ContentControlsLine } from '../../../components/ContentControlsLine'
import { EmptyState } from '../../../components/EmptyState'
import { FilterBar } from '../../../components/FilterBar'
import { PageNav } from '../../../components/PageNav'
import { RecordCard } from '../../../components/RecordCard'
import { listSections } from '../../../api/sectionApi'
import { usePlayerAccounts } from '../../../api/playerAccountsApi'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { cardGridSx } from '../../../utils/cardGrid'
import { initialsFromName } from '../../../utils/initials'
import { countText } from './linkRequestFormat'

// docs/specs/119 Part 3: "Players and their main agent". Manage agents opens the shared PlayerAgentActions (slice 4). Section and No main agent are saved per club; the search is per visit. Every filter is a backend parameter.
export function PlayerAccountsList({ clubId }: { clubId: string }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [managing, setManaging] = useState<{ playerId: string; name: string } | null>(null)
  const [{ sectionId, noMainAgent }, setFilters] = usePersistedListFilters(`playerAccounts:filters:${clubId}`, {
    sectionId: null as string | null,
    noMainAgent: false,
  })
  const debounced = useDebouncedValue(search, 300)
  const sections = useQuery({ queryKey: ['managed-club', clubId, 'sections'], queryFn: () => listSections(clubId) })
  const accounts = usePlayerAccounts(clubId, { sectionId: sectionId ?? undefined, noMainAgent, search: debounced, page })

  const change = (patch: Partial<{ sectionId: string | null; noMainAgent: boolean }>) => {
    setPage(0)
    setFilters(patch)
  }
  const data = accounts.data
  const noMainToggle = <CompactSwitch checked={noMainAgent} onChange={(checked) => change({ noMainAgent: checked })} label="No main agent" />

  return (
    <Box component="section" aria-labelledby="player-accounts-heading" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography id="player-accounts-heading" variant="h6" component="h2" fontWeight={700}>
        Players and their main agent
      </Typography>

      <FilterBar
        density="compact"
        sections={sections.data ?? []}
        sectionId={sectionId}
        onSectionChange={(value) => change({ sectionId: value })}
        searchValue={search}
        onSearchChange={(value) => {
          setPage(0)
          setSearch(value)
        }}
        searchPlaceholder="Search by player name"
        extraChips={noMainAgent ? [{ key: 'no-main', label: 'No main agent', onRemove: () => change({ noMainAgent: false }) }] : []}
        viewControls={noMainToggle}
        onClearAll={() => {
          setPage(0)
          setSearch('')
          setFilters({ sectionId: null, noMainAgent: false })
        }}
      />
      <ContentControlsLine
        scope={data ? `Showing ${countText(data.totalElements, 'player', 'players')}` : 'Loading players'}
        controls={noMainToggle}
      />

      {accounts.isPending && (
        <Box aria-busy="true" sx={cardGridSx}>
          <Skeleton variant="rounded" height={140} />
          <Skeleton variant="rounded" height={140} />
        </Box>
      )}
      {accounts.isError && <EmptyState title="Couldn't load players" description="Something went wrong loading the players. Please try again." />}
      {data && data.content.length === 0 && (
        <EmptyState
          title="No players found"
          description={noMainAgent ? 'Every player with these filters has a main agent.' : 'No players match these filters.'}
        />
      )}
      {data && data.content.length > 0 && (
        <>
          <Box sx={cardGridSx}>
            {data.content.map((account) => {
              const fullName = `${account.firstName} ${account.lastName}`
              return (
                <RecordCard
                  key={account.playerId}
                  title={fullName}
                  avatar={{ fallback: initialsFromName(fullName), shape: 'circular' }}
                  badge={account.mainAgentName ? undefined : { label: 'No main agent', tone: 'warning' }}
                  description={account.sectionName ?? 'No section'}
                  fields={[
                    { label: 'Main agent', value: account.mainAgentName ? `${account.mainAgentName}${account.mainAgentMaskedEmail ? ` (${account.mainAgentMaskedEmail})` : ''}` : 'Not recorded' },
                    { label: 'Other agents', value: String(account.otherAgentCount) },
                  ]}
                  footerActions={
                    <Button variant="secondary" size="compact" onClick={() => setManaging({ playerId: account.playerId, name: fullName })}>
                      Manage agents
                    </Button>
                  }
                />
              )
            })}
          </Box>
          <PageNav page={data.number} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}
      <Dialog open={Boolean(managing)} onClose={() => setManaging(null)} fullWidth maxWidth="sm">
        <DialogTitle>{managing ? `Agents for ${managing.name}` : ''}</DialogTitle>
        <DialogContent>{managing && <PlayerAgentActions clubId={clubId} playerId={managing.playerId} playerName={managing.name} />}</DialogContent>
      </Dialog>
    </Box>
  )
}
