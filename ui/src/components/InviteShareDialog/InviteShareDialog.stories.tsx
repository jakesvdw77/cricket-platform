import type { Meta, StoryObj } from '@storybook/react-vite'
import { InviteShareDialog } from './InviteShareDialog'

const meta: Meta<typeof InviteShareDialog> = {
  title: 'Components/InviteShareDialog',
  component: InviteShareDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    onClose: () => undefined,
    link: 'https://club.example/poll/123',
    buildText: (emoji: boolean) =>
      [`${emoji ? '🏏 ' : ''}*Thursday 5 November - Over 40 fixtures*`, `${emoji ? '📍 ' : ''}Over 40`, `${emoji ? '⏰ ' : ''}*Please reply by Wed 4 Nov, 09:15*`, '', 'https://club.example/poll/123', '', 'Thanks!'].join('\n'),
  },
}
export default meta

type Story = StoryObj<typeof InviteShareDialog>

export const Default: Story = {}

export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } }
