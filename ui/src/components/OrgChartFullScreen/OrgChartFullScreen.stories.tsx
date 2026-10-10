import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box, Button } from '@mui/material'
import { OrgChartFullScreen } from './OrgChartFullScreen'

const meta: Meta<typeof OrgChartFullScreen> = {
  title: 'Components/OrgChartFullScreen',
  component: OrgChartFullScreen,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof OrgChartFullScreen>

function Placeholder({ columns }: { columns: number }) {
  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: columns }, (_, index) => (
        <Box key={index} sx={{ width: 160, height: 120, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
          Section {index + 1}
        </Box>
      ))}
    </Box>
  )
}

function Demo({ columns }: { columns: number }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Expand</Button>
      <OrgChartFullScreen open={open} onClose={() => setOpen(false)} title="Club structure">
        <Placeholder columns={columns} />
      </OrgChartFullScreen>
    </>
  )
}

export const SmallChart: Story = { render: () => <Demo columns={3} /> }
export const WideChart: Story = { render: () => <Demo columns={14} /> }
