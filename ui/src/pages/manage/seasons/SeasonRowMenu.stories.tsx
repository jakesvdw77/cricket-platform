import type { Meta, StoryObj } from '@storybook/react-vite'
import { SeasonRowMenu } from './SeasonRowMenu'

const meta: Meta<typeof SeasonRowMenu> = {
  title: 'Pages/Manage/SeasonRowMenu',
  component: SeasonRowMenu,
}
export default meta

type Story = StoryObj<typeof SeasonRowMenu>

// docs/specs/129: the kebab of a season row or card: Open Season, Edit Season, Open Leagues, Open Matches.
export const Default: Story = { args: { season: { id: 'season-1', label: '2026/27' } } }
