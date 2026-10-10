import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import { Input } from '../Input'
import { Button } from '../Button'
import { RecordFormScreen } from './RecordFormScreen'

// No local MemoryRouter decorator here — .storybook/preview.tsx already wraps every story in one
// globally; adding a second nested <MemoryRouter> throws ("You cannot render a <Router> inside
// another <Router>") and was breaking every story (including pre-existing ones) under Storybook's
// interaction-test runner.
const meta: Meta<typeof RecordFormScreen> = {
  title: 'Components/RecordFormScreen',
  component: RecordFormScreen,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof RecordFormScreen>

export const Default: Story = {
  args: {
    title: 'Add Product',
    backTo: '/admin/configuration/products',
    backLabel: 'Back to Products',
    actions: (
      <>
        <Button variant="ghost">Cancel</Button>
        <Button>Save</Button>
      </>
    ),
    children: (
      <>
        <Input label="Code" />
        <Input label="Name" />
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Input label="Description" multiline minRows={3} />
        </Box>
        <Input label="Price" />
        <Input label="Currency" />
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Typography variant="body2" color="text.secondary">
            Full-width fields span both columns from the md breakpoint up.
          </Typography>
        </Box>
      </>
    ),
  },
}

// docs/specs/075-match-view-and-edit.md: a control right-aligned on the title row.
export const WithHeaderAction: Story = {
  args: {
    ...Default.args,
    title: 'Edit Match',
    headerAction: <Button variant="secondary">Availability</Button>,
  },
}

// docs/specs/008-product-catalog.md's Test Plan requires a story at each of 375/768/1280 —
// proves the single-column-at-xs / two-column-from-md field grid reflow described in the spec.
export const MobileViewport: Story = {
  args: Default.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Default.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Default.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}

// docs/specs/095-league-edit-gold-standard.md: tabs whose panels carry their own actions have no footer.
export const WithoutActions: Story = {
  args: { ...Default.args, title: 'Edit League', actions: undefined },
}

// docs/specs/095-league-edit-gold-standard.md: a tab strip on the page wash between the header and the card.
export const WithTabs: Story = {
  args: {
    ...Default.args,
    title: 'Edit League',
    tabs: (
      <Tabs value="details" variant="scrollable" scrollButtons={false} sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 44 }}>
        <Tab value="details" label="Details" sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600 }} />
        <Tab value="teams" label="Teams" sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600 }} />
        <Tab value="schedule" label="Schedule" sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600 }} />
      </Tabs>
    ),
  },
}
