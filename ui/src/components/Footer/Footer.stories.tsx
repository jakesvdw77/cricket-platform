import type { Meta, StoryObj } from '@storybook/react-vite'
import { Footer } from './Footer'

const meta: Meta<typeof Footer> = {
  title: 'Components/Footer',
  component: Footer,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof Footer>

export const Mobile: Story = {
  args: {},
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const Tablet: Story = {
  args: {},
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const Desktop: Story = {
  args: {},
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
