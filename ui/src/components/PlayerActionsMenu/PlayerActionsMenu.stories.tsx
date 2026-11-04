import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { PlayerActionsMenu } from './PlayerActionsMenu'
import type { Player } from '../../api/playerApi'

const player = { id: 'p1', firstName: 'Sipho', lastName: 'Ndlovu', active: true, verificationStatus: 'UNVERIFIED' } as Player

const meta: Meta<typeof PlayerActionsMenu> = {
  title: 'Components/PlayerActionsMenu',
  component: PlayerActionsMenu,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  args: { player, onStatusAction: () => undefined },
}
export default meta
type Story = StoryObj<typeof PlayerActionsMenu>

export const Kebab: Story = {}
export const ManagePlayerButton: Story = { args: { trigger: 'button' } }
