import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfileSwitcher } from './ProfileSwitcher'

const meta: Meta<typeof ProfileSwitcher> = { title: 'Components/ProfileSwitcher', component: ProfileSwitcher }
export default meta
type Story = StoryObj<typeof ProfileSwitcher>

const items = [
  { key: 'MANAGER:1', title: 'Club manager', subtitle: 'Vets', active: true, onChoose: () => undefined },
  { key: 'MY_PLAYERS:', title: 'Player Hub', subtitle: 'Anton de Villiers and 1 more', active: false, onChoose: () => undefined },
]

export const Open: Story = {
  render: () => {
    const anchor = document.body
    return <ProfileSwitcher items={items} anchorEl={anchor} onClose={() => undefined} />
  },
}
