import type { Meta, StoryObj } from '@storybook/react-vite'
import { Stack } from '@mui/material'
import { TestimonialCard } from './TestimonialCard'

const meta: Meta<typeof TestimonialCard> = {
  title: 'Components/TestimonialCard',
  component: TestimonialCard,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof TestimonialCard>

export const Default: Story = {
  args: {
    quote:
      'Onboarding our club took one afternoon instead of the two weeks we budgeted for. The section admins were self-sufficient within a day.',
    name: 'Riaan Coetzee',
    role: 'Chairman, Riverside CC',
  },
}

export const WithAvatar: Story = {
  args: {
    quote: 'Finally a scoring app that works on a phone in bright sunlight.',
    name: 'Sarah Mokoena',
    role: 'Fixtures Secretary, Colts CC',
    avatarUrl: 'https://i.pravatar.cc/72?img=47',
  },
}

export const Row: Story = {
  render: () => (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <TestimonialCard
        quote="Onboarding our club took one afternoon instead of the two weeks we budgeted for."
        name="Riaan Coetzee"
        role="Chairman, Riverside CC"
      />
      <TestimonialCard
        quote="Every section sees exactly the fixtures relevant to them, nothing else."
        name="Devan Pillay"
        role="Juniors Convenor, Oakfield CC"
      />
    </Stack>
  ),
}
