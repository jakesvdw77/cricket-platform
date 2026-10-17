import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../Button'
import { SharePreviewStage } from '../SharePreviewStage'
import { ShareFormatScreen } from './ShareFormatScreen'

const meta: Meta<typeof ShareFormatScreen> = {
  title: 'Components/ShareFormatScreen',
  component: ShareFormatScreen,
  parameters: { layout: 'padded' },
  args: {
    title: 'WhatsApp',
    controls: <p>Template chips and include switches go here.</p>,
    preview: <SharePreviewStage caption="Live preview">Riverside won by 5 wickets</SharePreviewStage>,
    actions: <Button>Copy text</Button>,
  },
}
export default meta

type Story = StoryObj<typeof ShareFormatScreen>

export const Default: Story = {}
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }
export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } }
export const Desktop: Story = { parameters: { viewport: { defaultViewport: 'desktop' } } }
