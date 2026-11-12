import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Box } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { item } from '../../../../test/tickerFixtures'
import { HUB_GROUND } from '../hubStyle'
import { HubFooterButton } from '../HubFrame'
import type { TickerItem } from '../tickerTypes'
import { HubFooter } from './HubFooter'

// docs/specs/146: the Hub console footer band. It reads the address to know the player, so each story moves the (storybook) memory
// router to a Player Hub path first. Items are given, so no request is made. Viewports 375, 768 and 1280.
const BASE = '/account/players/k1'
const items: TickerItem[] = [
  item('live', 'm1', { pinned: true, to: `${BASE}/schedule/matches/m1`, parts: [{ type: 'strong', text: 'Villagers v Rovers' }, { type: 'muted', text: 'Started 1h 20m ago' }] }),
  item('result', 'r1', { to: `${BASE}/results/r1`, parts: [{ type: 'strong', text: 'Villagers' }, { type: 'text', text: ' beat ' }, { type: 'strong', text: 'Rovers' }, { type: 'text', text: ' by 24 runs' }, { type: 'muted', text: 'Over 40, Sat' }] }),
  item('poll', 'p1', { to: `${BASE}/availability`, parts: [{ type: 'text', text: 'Availability for ' }, { type: 'strong', text: 'Saturday' }, { type: 'text', text: ' closes ' }, { type: 'strong', text: 'tonight' }] }),
]

function AtPath({ path, children }: { path: string; children: ReactNode }) {
  const navigate = useNavigate()
  useEffect(() => {
    void navigate(path, { replace: true })
  }, [navigate, path])
  return <>{children}</>
}

const meta: Meta<typeof HubFooter> = {
  title: 'Pages/View/Player Hub/HubFooter',
  component: HubFooter,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (StoryComponent) => (
      <QueryClientProvider client={new QueryClient()}>
        <AtPath path={`${BASE}/availability`}>
          <Box sx={{ bgcolor: HUB_GROUND, pt: 4, display: 'grid' }}>
            <StoryComponent />
          </Box>
        </AtPath>
      </QueryClientProvider>
    ),
  ],
  args: { fill: true, items, back: <HubFooterButton onClick={() => undefined}>Back to menu</HubFooterButton> },
}
export default meta

type Story = StoryObj<typeof HubFooter>

export const WithBackAndItems: Story = {}
export const WithoutBack: Story = { args: { back: undefined } }
// Nothing to show: exactly today's footer, just the Back button.
export const WithBackNoItems: Story = { args: { items: [] } }
// Nothing to show and no Back: no footer at all.
export const NoBackNoItems: Story = { args: { back: undefined, items: [] } }

export const Phone375: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }
export const Tablet768: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } }
export const Desktop1280: Story = { parameters: { viewport: { defaultViewport: 'desktop' } } }

// A page that always hides the ticker: Watch Live.
export const HiddenOnWatchLive: Story = {
  decorators: [
    (StoryComponent) => (
      <AtPath path={`${BASE}/schedule/matches/m1/watch`}>
        <StoryComponent />
      </AtPath>
    ),
  ],
}
