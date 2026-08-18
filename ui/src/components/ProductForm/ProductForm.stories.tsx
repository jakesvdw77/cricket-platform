import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { ProductForm } from './ProductForm'

const meta: Meta<typeof ProductForm> = {
  title: 'Components/ProductForm',
  component: ProductForm,
  parameters: { layout: 'padded' },
  // ProductForm's <form> renders with display: 'contents' so its fields become direct grid
  // items of the parent grid — decorate with the same grid RecordFormScreen provides in the
  // real app so this preview reflects the actual one/two-column layout.
  decorators: [
    (Story) => (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof ProductForm>

export const Create: Story = {
  args: {
    onSubmit: () => undefined,
  },
}

export const EditDraft: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: {
      code: 'CLUB_STANDARD',
      name: 'Club Standard',
      description: 'Everything a growing club needs.',
      isFree: false,
      price: 49.99,
      currency: 'USD',
      billingInterval: 'MONTHLY',
      maxSections: 4,
      maxTeams: 10,
      maxPlayers: 200,
      displayOrder: 1,
      status: 'DRAFT',
    },
  },
}

export const EditActiveFree: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: {
      code: 'FREE',
      name: 'Free',
      description: 'Get started at no cost.',
      isFree: true,
      displayOrder: 0,
      status: 'ACTIVE',
    },
  },
}

export const Retired: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: {
      code: 'LEGACY_TIER',
      name: 'Legacy Tier',
      isFree: false,
      price: 19.99,
      currency: 'USD',
      billingInterval: 'MONTHLY',
      status: 'RETIRED',
    },
  },
}

// docs/specs/008-product-catalog.md's Test Plan requires a story at each of 375/768/1280 — the
// decorator above already reflows the field grid single/two-column at md, same as RecordFormScreen.
export const MobileViewport: Story = {
  args: EditDraft.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: EditDraft.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: EditDraft.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
