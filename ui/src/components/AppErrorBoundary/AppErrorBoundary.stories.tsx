import type { Meta, StoryObj } from '@storybook/react-vite'
import { AppErrorBoundary } from './AppErrorBoundary'

function Boom(): never {
  throw new Error('Storybook crash')
}

const meta: Meta<typeof AppErrorBoundary> = {
  title: 'Components/AppErrorBoundary',
  component: AppErrorBoundary,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof AppErrorBoundary>

export const Crashed: Story = { render: () => <AppErrorBoundary><Boom /></AppErrorBoundary> }
