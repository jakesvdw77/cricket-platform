import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectionGuard } from './ConnectionGuard'
import { reportBackendFailure } from '../../api/connectionStatus'
import { AxiosError } from 'axios'

const meta: Meta<typeof ConnectionGuard> = {
  title: 'Components/ConnectionGuard',
  component: ConnectionGuard,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof ConnectionGuard>

export const ServerUnreachable: Story = {
  render: () => {
    reportBackendFailure(new AxiosError('Network Error', 'ERR_NETWORK'))
    return (
      <QueryClientProvider client={new QueryClient()}>
        <ConnectionGuard>
          <p>The app</p>
        </ConnectionGuard>
      </QueryClientProvider>
    )
  },
}
