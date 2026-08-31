import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { PlayerForm } from './PlayerForm'

const meta: Meta<typeof PlayerForm> = {
  title: 'Components/PlayerForm',
  component: PlayerForm,
  parameters: { layout: 'padded' },
  // PlayerForm's own <form> renders the same one/two-column grid RecordFormScreen provides in the
  // real app (see SponsorForm.stories.tsx's identical decorator for this tabbed-form shape) —
  // decorate with that same grid so this preview reflects the actual layout. Unlike SponsorForm,
  // PlayerForm doesn't own its own Tabs bar (PlayerFormPage does) — activeTab is a plain prop, so
  // each of the three panels gets its own story rather than one story with clickable tabs.
  decorators: [
    (Story) => (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof PlayerForm>

const editValues = {
  firstName: 'Sipho',
  lastName: 'Ndlovu',
  dateOfBirth: '2010-04-12',
  gender: 'MALE' as const,
  photoUrl: '/media/managed/player-photo.png',
  clubMembershipNumber: 'RCC-042',
  medicalAidProvider: 'Discovery',
  medicalAidMemberNumber: 'DH-99123',
  phone: '+27 21 555 0188',
  email: 'sipho.ndlovu@example.com',
  altContactName: 'Nomvula Ndlovu',
  altContactPhone: '+27 21 555 0199',
  battingStance: 'RIGHT_HANDED' as const,
  bowlingArm: 'RIGHT_ARM' as const,
  bowlingType: 'OFF_BREAK' as const,
  isWicketKeeper: true,
}

export const BasicInfoCreate: Story = {
  args: {
    activeTab: 0,
    onSubmit: () => undefined,
  },
}

export const BasicInfoEdit: Story = {
  args: {
    activeTab: 0,
    onSubmit: () => undefined,
    initialValues: editValues,
  },
}

export const ContactInfoEdit: Story = {
  args: {
    activeTab: 1,
    onSubmit: () => undefined,
    initialValues: editValues,
  },
}

export const CricketInfoEdit: Story = {
  args: {
    activeTab: 2,
    onSubmit: () => undefined,
    initialValues: editValues,
  },
}

// docs/standards/design-system.md's Storybook rule requires a viewport story at 375/768/1280 for
// every component — same trio SponsorForm.stories.tsx/ClubForm.stories.tsx already establish.
export const MobileViewport: Story = {
  args: BasicInfoEdit.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: BasicInfoEdit.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: BasicInfoEdit.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
