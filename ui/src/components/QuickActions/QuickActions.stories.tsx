import type { Meta, StoryObj } from '@storybook/react-vite'
import { QuickActions } from './QuickActions'
import type { QuickAction } from './QuickActions'

const all: QuickAction[] = [
  { id: 'create-match', label: 'Create match', to: '/manage/fixtures/matches/new', icon: 'nav/upcoming-matches' },
  { id: 'create-poll', label: 'Create availability poll', to: '/manage/availability/new', icon: 'nav/availability-polls' },
  { id: 'add-player', label: 'Add player', to: '/manage/players/new', icon: 'nav/cricket-players' },
  { id: 'message-squad', label: 'Message the squad', to: '/manage/communication', icon: 'nav/communication' },
]

const meta: Meta<typeof QuickActions> = {
  title: 'Components/QuickActions',
  component: QuickActions,
  args: { actions: all },
  decorators: [
    (Story) => (
        <div style={{ minHeight: 420, display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
          <Story />
        </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof QuickActions>

// From md: the Actions button and its menu.
export const Wide: Story = { parameters: { viewport: { defaultViewport: 'desktop' } } }

// Below md: the controlled round + button and its list of tappable rows, fixed bottom-right above the tab bar.
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }

export const SingleAction: Story = { args: { actions: all.slice(2, 3) } }
