import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { blackAlpha } from '../../../../brandTokens'
import { item, SYNTHETIC_KINDS } from '../../../../test/tickerFixtures'
import { HUB_GROUND } from '../hubStyle'
import type { TickerItem } from '../tickerTypes'
import { HubTicker } from './HubTicker'

// docs/specs/146: the scoreboard strip on the dark console band. Viewports 375, 768 and 1280 (the viewport toolbar); the items are
// synthetic, because the strip knows nothing about matches, results or polls.
const BASE = '/account/players/k1'

const built: TickerItem[] = [
  item('live', 'm1', { pinned: true, to: `${BASE}/schedule/matches/m1`, parts: [{ type: 'strong', text: 'Villagers v Rovers' }, { type: 'muted', text: 'Started 1h 20m ago' }] }),
  item('result', 'r1', { to: `${BASE}/results/r1`, parts: [{ type: 'strong', text: 'Villagers' }, { type: 'text', text: ' beat ' }, { type: 'strong', text: 'Rovers' }, { type: 'text', text: ' by 24 runs' }, { type: 'muted', text: 'Over 40, Sat' }] }),
  item('upcoming', 'u1', { to: `${BASE}/schedule/matches/u1`, parts: [{ type: 'text', text: 'Sat 14:00 ' }, { type: 'strong', text: 'Villagers v Eagles' }, { type: 'muted', text: 'Main Oval, starts in 3h 10m' }] }),
  item('poll', 'p1', { to: `${BASE}/availability`, parts: [{ type: 'text', text: 'Availability for ' }, { type: 'strong', text: 'Saturday' }, { type: 'text', text: ' closes ' }, { type: 'strong', text: 'tonight' }] }),
]

const meta: Meta<typeof HubTicker> = {
  title: 'Pages/View/Player Hub/HubTicker',
  component: HubTicker,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (StoryComponent) => (
      <Box sx={{ bgcolor: HUB_GROUND, pt: 4 }}>
        <Box sx={{ display: 'flex', borderTop: '1px solid rgba(247,243,232,.28)', bgcolor: blackAlpha(0.42), minHeight: 56 }}>
          <StoryComponent />
        </Box>
      </Box>
    ),
  ],
  args: { items: built },
}
export default meta

type Story = StoryObj<typeof HubTicker>

// All four built kinds: the live match first and pinned, a result, the next match and a poll closing soon.
export const BuiltKinds: Story = {}

export const Phone375: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }
export const Tablet768: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } }
export const Desktop1280: Story = { parameters: { viewport: { defaultViewport: 'desktop' } } }

// A live match leads the cycle (it is repeated near the middle when the cycle is long).
export const LivePinned: Story = { args: { items: [built[0], built[2]] } }

// Under prefers-reduced-motion: one item at a time, every 6 seconds, with Previous, Pause and Next. The pulse stands still.
export const ReducedMotion: Story = { args: { reducedMotion: true } }

// A single short item fits the strip, so it does not scroll: it sits centred.
export const SingleItemFits: Story = { args: { items: [item('poll', 'p1', { to: `${BASE}/availability`, parts: [{ type: 'strong', text: 'Poll closes tonight' }] })] } }

export const LongItem: Story = {
  args: {
    items: [
      item('result', 'r1', {
        to: `${BASE}/results/r1`,
        parts: [{ type: 'strong', text: 'Greenwood Under 15 Development Squad' }, { type: 'text', text: ' beat ' }, { type: 'strong', text: 'Northern Suburbs Cricket Club Under 15 Gold' }, { type: 'text', text: ' by 124 runs' }, { type: 'muted', text: 'Over 40 Premier Division, Sat' }],
      }),
    ],
  },
}

// Nothing to show: the strip renders nothing (the footer is then today's footer).
export const Empty: Story = { args: { items: [] } }

// Later kinds, as synthetic items with their own rules: the strip is unchanged (docs/specs/146 acceptance criterion 16).
export const FutureKinds: Story = {
  args: {
    kinds: {
      ...SYNTHETIC_KINDS,
      milestone: { label: 'Milestone', tone: 'win', defaultWeight: 1, maxPerCycle: 2 },
      standing: { label: 'Table', tone: 'next', defaultWeight: 1, maxPerCycle: 1 },
      birthday: { label: 'Birthday', tone: 'message', defaultWeight: 1, maxPerCycle: 1 },
      weather: { label: 'Weather', tone: 'next', defaultWeight: 1, maxPerCycle: 1 },
      onThisDay: { label: 'History', tone: 'info', defaultWeight: 1, maxPerCycle: 1 },
      funFact: { label: 'Did You Know', tone: 'info', defaultWeight: 1, maxPerCycle: 1 },
    },
    items: [
      item('message', 'a', { to: `${BASE}/updates`, parts: [{ type: 'strong', text: 'Nets' }, { type: 'text', text: ' move to 5pm on Thursday' }] }),
      item('sponsor', 'b', { to: null, parts: [{ type: 'plate', text: 'Acme Hardware' }, { type: 'muted', text: 'Proud club sponsor' }] }),
      item('milestone', 'c', { to: `${BASE}/results/r1`, parts: [{ type: 'strong', text: 'Sam' }, { type: 'text', text: ' scored a fifty' }] }),
      item('standing', 'd', { to: `${BASE}/schedule/leagues`, parts: [{ type: 'text', text: 'Division 1: ' }, { type: 'strong', text: 'Villagers' }, { type: 'text', text: ' top on 22 points' }] }),
      item('birthday', 'e', { to: null, parts: [{ type: 'text', text: 'Happy birthday ' }, { type: 'strong', text: 'Alex' }] }),
      item('weather', 'f', { to: `${BASE}/schedule/matches/u1`, parts: [{ type: 'text', text: 'Saturday: ' }, { type: 'strong', text: '22 to 27 degrees, dry' }] }),
      item('onThisDay', 'g', { to: `${BASE}/results/r0`, parts: [{ type: 'text', text: 'On this day in 2019: ' }, { type: 'strong', text: 'Villagers won by 6 wickets' }] }),
      item('funFact', 'h', { to: null, parts: [{ type: 'text', text: 'Did you know the club has won ' }, { type: 'strong', text: '12 trophies' }] }),
    ],
  },
}
