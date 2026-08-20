import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { AddressFields } from './AddressFields'

const meta: Meta<typeof AddressFields> = {
  title: 'Components/AddressFields',
  component: AddressFields,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof AddressFields>

export const Empty: Story = {
  args: {
    value: { number: null, street: null, city: null, provinceState: null, country: null, postalCode: null },
    onChange: () => undefined,
  },
}

export const Filled: Story = {
  args: {
    value: {
      number: '12',
      street: 'Main Road',
      city: 'Cape Town',
      provinceState: 'Western Cape',
      country: 'South Africa',
      postalCode: '8001',
    },
    onChange: () => undefined,
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
