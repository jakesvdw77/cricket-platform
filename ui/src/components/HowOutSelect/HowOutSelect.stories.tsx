import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { HowOutSelect } from './HowOutSelect'
import type { DismissalType } from '../../api/matchResultApi'

const meta: Meta<typeof HowOutSelect> = {
  title: 'Components/HowOutSelect',
  component: HowOutSelect,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof HowOutSelect>

function Demo({ initial, fullWidth }: { initial: DismissalType | null; fullWidth?: boolean }) {
  const [value, setValue] = useState<DismissalType | null>(initial)
  return (
    <Box sx={{ maxWidth: 320, minHeight: 300 }}>
      <HowOutSelect value={value} onChange={setValue} ariaLabel="How out, A. Smith" fullWidth={fullWidth} />
    </Box>
  )
}

export const Empty: Story = { render: () => <Demo initial={null} /> }
export const Caught: Story = { render: () => <Demo initial="CAUGHT" /> }
export const PhoneWidth: Story = { render: () => <Demo initial="BOWLED" fullWidth /> }
