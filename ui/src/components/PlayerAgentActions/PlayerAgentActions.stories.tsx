import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlayerAgentActions } from './PlayerAgentActions'

// Needs the manager API; in Storybook the read fails and the component renders nothing, so this shows the loading skeleton.
const meta: Meta<typeof PlayerAgentActions> = {
  title: 'Components/PlayerAgentActions',
  component: PlayerAgentActions,
  decorators: [(Story) => <QueryClientProvider client={new QueryClient()}><Story /></QueryClientProvider>],
}
export default meta

export const Default: StoryObj<typeof PlayerAgentActions> = {
  args: { clubId: 'club-1', playerId: 'player-1', playerName: 'Anton de Villiers' },
}
