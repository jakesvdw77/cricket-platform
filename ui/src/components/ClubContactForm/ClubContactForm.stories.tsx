import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { ClubContactForm } from './ClubContactForm'

const meta: Meta<typeof ClubContactForm> = {
  title: 'Components/ClubContactForm',
  component: ClubContactForm,
  parameters: { layout: 'padded' },
  // ClubContactForm's <form> renders with display: 'contents' so its fields become direct grid
  // items of the parent grid — decorate with the same grid RecordFormScreen provides in the real
  // app (see ProductForm.stories.tsx's identical decorator) so this preview reflects the actual
  // one/two-column layout.
  decorators: [
    (Story) => (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof ClubContactForm>

export const Create: Story = {
  args: {
    onSubmit: () => undefined,
  },
}

export const EditPrimaryContact: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: {
      contact: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@riverside-cc.example.com',
        phone: '+27 21 555 0100',
      },
      role: 'Chairman',
      isPrimary: true,
      photoUrl: '/media/managed/contact-photo.png',
    },
  },
}

// docs/standards/design-system.md's Storybook rule requires a viewport story at 375/768/1280 for
// every component — same trio ProductForm.stories.tsx already establishes for this exact
// flat-field-grid anatomy.
export const MobileViewport: Story = {
  args: EditPrimaryContact.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: EditPrimaryContact.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: EditPrimaryContact.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
