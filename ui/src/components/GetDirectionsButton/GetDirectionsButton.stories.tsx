import type { Meta, StoryObj } from '@storybook/react-vite'
import { GetDirectionsButton } from './GetDirectionsButton'

const target = { point: { lat: -26.1, lng: 28.05 }, approximate: false, viaAccess: false, name: 'Wanderers', accessNote: null, addressText: 'Wanderers\nJohannesburg' }

const meta: Meta<typeof GetDirectionsButton> = {
  title: 'Components/GetDirectionsButton',
  component: GetDirectionsButton,
  args: { target },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
}
export default meta

type Story = StoryObj<typeof GetDirectionsButton>

export const Default: Story = {}
export const Approximate: Story = { args: { target: { ...target, approximate: true } } }
export const AccessPoint: Story = { args: { target: { ...target, viaAccess: true, accessNote: 'Use gate 2 off Main Rd' } } }
export const InlineLink: Story = { args: { variant: 'link' } }
export const HiddenWithNoPoint: Story = { args: { target: null } }
