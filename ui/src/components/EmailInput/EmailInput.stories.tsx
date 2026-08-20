import type { Meta, StoryObj } from '@storybook/react-vite'
import { EmailInput } from './EmailInput'

const meta: Meta<typeof EmailInput> = {
  title: 'Components/EmailInput',
  component: EmailInput,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof EmailInput>

export const Default: Story = {
  args: {
    value: '',
    onChange: () => undefined,
  },
}

export const Filled: Story = {
  args: {
    value: 'jane.doe@example.com',
    onChange: () => undefined,
  },
}

export const WithError: Story = {
  args: {
    value: 'not an email',
    onChange: () => undefined,
    error: 'Enter a valid email address',
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
