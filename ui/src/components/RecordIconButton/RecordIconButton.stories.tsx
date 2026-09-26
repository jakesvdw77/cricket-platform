import type { Meta, StoryObj } from '@storybook/react-vite'
import { RecordIconButton } from './RecordIconButton'

const meta: Meta<typeof RecordIconButton> = {
  title: 'Components/RecordIconButton',
  component: RecordIconButton,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof RecordIconButton>

export const Circular: Story = {
  args: {
    shape: 'circular',
    label: 'Jane Smith — Manager',
    name: 'Jane Smith',
    initials: 'JS',
    onClick: () => undefined,
  },
}

export const Rounded: Story = {
  args: {
    shape: 'rounded',
    label: 'Acme Bank — Sponsor',
    name: 'Acme Bank',
    initials: 'AC',
    onClick: () => undefined,
  },
}

export const MobileViewport: Story = {
  args: Circular.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Circular.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Circular.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
