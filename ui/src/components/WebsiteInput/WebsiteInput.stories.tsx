import type { Meta, StoryObj } from '@storybook/react-vite'
import { WebsiteInput } from './WebsiteInput'

const meta: Meta<typeof WebsiteInput> = {
  title: 'Components/WebsiteInput',
  component: WebsiteInput,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof WebsiteInput>

export const Default: Story = {
  args: {
    value: '',
    onChange: () => undefined,
  },
}

export const Filled: Story = {
  args: {
    value: 'https://riverside-cc.example.com',
    onChange: () => undefined,
  },
}

export const WithError: Story = {
  args: {
    value: 'not a url',
    onChange: () => undefined,
    error: 'Enter a valid website URL',
  },
}

// docs/standards/design-system.md's Storybook rule — every component gets a story with the
// viewport addon at 375/768/1280.
export const MobileViewport: Story = {
  args: Filled.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Filled.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Filled.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
