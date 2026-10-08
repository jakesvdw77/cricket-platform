import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import api from '../../../../api/axiosConfig'
import { availabilitySummaryPlayersKey } from '../../../../api/availabilitySummaryApi'
import type { AvailabilitySummaryPlayer, AvailabilitySummaryPlayersPage } from '../../../../api/availabilitySummaryApi'
import { PlayersPanel } from './PlayersPanel'
import type { PlayersPanelTab } from './PlayersPanel'

const FILTERS = { type: 'ALL' as const, includeClosed: false, closingSoon: false }

const players: AvailabilitySummaryPlayer[] = [
  {
    playerProfileId: 'p1',
    displayName: 'Ann Lee',
    polls: [
      { kind: 'SQUAD', id: 'poll-1', matchId: 'm-1', title: 'Lions vs Rivals CC' },
      { kind: 'GROUP', id: 'round-1', matchId: null, title: 'Sat 6 Jun - U13 Boys fixtures' },
    ],
  },
  { playerProfileId: 'p2', displayName: 'Bob Ray', polls: [{ kind: 'SQUAD', id: 'poll-2', matchId: 'm-2', title: 'Tigers vs Eagles' }] },
  { playerProfileId: 'p3', displayName: 'Cara Singh', polls: [{ kind: 'GROUP', id: 'round-1', matchId: null, title: 'Sat 6 Jun - U13 Boys fixtures' }] },
]

function page(content: AvailabilitySummaryPlayer[], number = 0, totalPages = 1): AvailabilitySummaryPlayersPage {
  return { content, totalElements: content.length, totalPages, number, size: 25, last: number + 1 >= totalPages }
}

// Success states are seeded into the query cache under the panel's own key; loading and error swap the axios adapter.
function Stage({ tab, data, mode = 'seeded' }: { tab: PlayersPanelTab; data?: AvailabilitySummaryPlayersPage; mode?: 'seeded' | 'loading' | 'error' }) {
  const [open, setOpen] = useState(true)
  const [current, setCurrent] = useState(tab)
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
    if (mode === 'seeded' && data) {
      for (const kind of ['responded', 'awaiting'] as const) {
        queryClient.setQueryData(availabilitySummaryPlayersKey('club-1', { ...FILTERS, kind, search: '' }), {
          pages: [data],
          pageParams: [0],
        })
      }
    }
    return queryClient
  })
  // Loading and error swap the axios adapter for the story's lifetime only, and put the original back after.
  useEffect(() => {
    if (mode === 'seeded') return undefined
    const original = api.defaults.adapter
    api.defaults.adapter = () =>
      mode === 'loading' ? new Promise(() => undefined) : Promise.reject(new Error('Players unavailable'))
    return () => {
      api.defaults.adapter = original
    }
  }, [mode])
  return (
    <QueryClientProvider client={client}>
      <button type="button" onClick={() => setOpen(true)}>
        Open players
      </button>
      <PlayersPanel
        open={open}
        onClose={() => setOpen(false)}
        clubId="club-1"
        tab={current}
        onTabChange={setCurrent}
        filters={FILTERS}
        counts={{ responded: 18, awaiting: 6 }}
        scope="Vets › Over 40 · Over 40 League"
      />
    </QueryClientProvider>
  )
}

const meta: Meta<typeof Stage> = {
  title: 'Pages/Availability/PlayersPanel',
  component: Stage,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof Stage>

export const StillToAnswer: Story = { args: { tab: 'awaiting', data: page(players) } }
export const Responded: Story = { args: { tab: 'responded', data: page(players) } }
export const ShowMore: Story = { args: { tab: 'awaiting', data: page(players, 0, 3) } }
export const EveryoneAnswered: Story = { args: { tab: 'awaiting', data: page([]) } }
export const NoAnswersYet: Story = { args: { tab: 'responded', data: page([]) } }
export const Loading: Story = { args: { tab: 'awaiting', mode: 'loading' } }
export const ErrorState: Story = { args: { tab: 'awaiting', mode: 'error' } }
export const Phone: Story = {
  args: { tab: 'awaiting', data: page(players) },
  parameters: { viewport: { defaultViewport: 'mobile' } },
}
