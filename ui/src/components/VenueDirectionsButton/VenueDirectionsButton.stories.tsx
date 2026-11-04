import type { Meta, StoryObj } from '@storybook/react-vite'
import { VenueDirectionsButton } from './VenueDirectionsButton'

const meta: Meta<typeof VenueDirectionsButton> = {
  title: 'Components/VenueDirectionsButton',
  component: VenueDirectionsButton,
  args: {
    venue: 'Hofmeyer Park',
    target: { name: 'Hofmeyer Park', point: { lat: -25.7, lng: 28.2 }, addressText: 'Hofmeyer Park', approximate: false, viaAccess: false, accessNote: null },
  },
}
export default meta

type Story = StoryObj<typeof VenueDirectionsButton>

export const Default: Story = {}

export const Approximate: Story = { args: { target: { name: 'Hofmeyer Park', point: { lat: -25.7, lng: 28.2 }, addressText: 'Pretoria', approximate: true, viaAccess: false, accessNote: null } } }
