import type { Meta, StoryObj } from '@storybook/react-vite'
import { LeagueEditTabs } from './LeagueEditTabs'

// No local router: .storybook/preview.tsx already wraps every story in a MemoryRouter (the strip reads ?tab=).
const meta: Meta<typeof LeagueEditTabs> = {
  title: 'Pages/Manage/LeagueEditTabs',
  component: LeagueEditTabs,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof LeagueEditTabs>

// docs/specs/095: the Edit League tab strip; with no ?tab= the Details tab is selected.
export const Default: Story = {}

// Scrolls sideways inside itself on a phone.
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }
