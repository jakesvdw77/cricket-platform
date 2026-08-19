import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { ClubNameSlugFields } from './ClubNameSlugFields'

const meta: Meta<typeof ClubNameSlugFields> = {
  title: 'Components/ClubNameSlugFields',
  component: ClubNameSlugFields,
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

type Story = StoryObj<typeof ClubNameSlugFields>

export const Default: Story = {
  args: {
    name: 'Riverside Cricket Club',
    slug: 'riverside-cricket-club',
    slugTouched: false,
    onNameChange: () => undefined,
    onSlugChange: () => undefined,
  },
}

export const WithErrors: Story = {
  args: {
    name: '',
    slug: '',
    slugTouched: true,
    nameError: 'Name is required',
    slugError: 'Slug is required',
    onNameChange: () => undefined,
    onSlugChange: () => undefined,
  },
}

// docs/standards/design-system.md's Storybook rule — every component gets a story with the
// viewport addon at 375/768/1280, matching ClubForm.stories.tsx's own precedent.
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
