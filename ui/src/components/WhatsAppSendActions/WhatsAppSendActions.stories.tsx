import type { Meta, StoryObj } from '@storybook/react-vite'
import { WhatsAppSendActions } from './WhatsAppSendActions'

const meta: Meta<typeof WhatsAppSendActions> = {
  title: 'Components/WhatsAppSendActions',
  component: WhatsAppSendActions,
}
export default meta

type Story = StoryObj<typeof WhatsAppSendActions>

export const Default: Story = {
  args: { text: '🏏 *Availability: Under 15s vs Riverside*\n\n👇 Tap your name and set your status:\nhttps://example.test/poll/1' },
}

export const TooLongForTheLink: Story = {
  args: { text: 'A very long message. '.repeat(120) },
}

export const Disabled: Story = {
  args: { text: 'Hello', disabled: true },
}

export const Mobile: Story = { ...Default, parameters: { viewport: { defaultViewport: 'mobile' } } }
export const Tablet: Story = { ...Default, parameters: { viewport: { defaultViewport: 'tablet' } } }
export const Desktop: Story = { ...Default, parameters: { viewport: { defaultViewport: 'desktop' } } }
export const TooLongForTheLinkMobile: Story = { ...TooLongForTheLink, parameters: { viewport: { defaultViewport: 'mobile' } } }
