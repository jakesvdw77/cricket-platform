import type { Meta, StoryObj } from '@storybook/react-vite'
import { PhoneInput } from './PhoneInput'

const meta: Meta<typeof PhoneInput> = {
  title: 'Components/PhoneInput',
  component: PhoneInput,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof PhoneInput>

export const Default: Story = {
  args: {
    value: '',
    onChange: () => undefined,
  },
}

export const Filled: Story = {
  args: {
    value: '+27 21 555 0100',
    onChange: () => undefined,
  },
}

export const WithError: Story = {
  args: {
    value: 'abc',
    onChange: () => undefined,
    error: 'Enter a valid phone number',
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
