import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Stack, Typography } from '@mui/material'
import { StandoutToggle } from './StandoutToggle'
import type { FeaturedOverride } from '../../api/matchResultApi'

const meta: Meta<typeof StandoutToggle> = {
  title: 'Components/StandoutToggle',
  component: StandoutToggle,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof StandoutToggle>

function Row({ suggested, label, readOnly }: { suggested: boolean; label: string; readOnly?: boolean }) {
  const [override, setOverride] = useState<FeaturedOverride | null>(null)
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <StandoutToggle suggested={suggested} override={override} onChange={setOverride} playerLabel={label} readOnly={readOnly} />
      <Typography variant="body2">{label}</Typography>
    </Stack>
  )
}

export const SuggestedAndNot: Story = {
  render: () => (
    <Stack>
      <Row suggested label="A. Smith (suggested)" />
      <Row suggested={false} label="B. Jones (not suggested)" />
    </Stack>
  ),
}

export const ReadOnly: Story = {
  render: () => (
    <Stack>
      <Row suggested label="A. Smith" readOnly />
      <Row suggested={false} label="B. Jones" readOnly />
    </Stack>
  ),
}
