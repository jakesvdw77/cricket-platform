import { useState } from 'react'
import { Button, Typography } from '@mui/material'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { BottomSheet } from './BottomSheet'
import type { BottomSheetProps } from './BottomSheet'

const meta: Meta<typeof BottomSheet> = {
  title: 'Components/BottomSheet',
  component: BottomSheet,
  parameters: { layout: 'fullscreen', viewport: { defaultViewport: 'mobile' } },
}
export default meta

type Story = StoryObj<typeof BottomSheet>

const base = { open: true, onOpen: () => undefined, onClose: () => undefined, ariaLabel: 'Example' }

export const WithTitleAndClose: Story = {
  args: { ...base, title: 'Menu', closeLabel: 'Close menu', children: <Typography>Sheet content</Typography> },
}

export const TitleOnly: Story = {
  args: { ...base, title: 'Filters', children: <Typography>Sheet content</Typography> },
}

function InteractiveSheet(args: BottomSheetProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open sheet</Button>
      <BottomSheet {...args} open={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} />
    </>
  )
}

export const Interactive: Story = {
  args: { ...base, open: false, title: 'Menu', closeLabel: 'Close menu', children: <Typography>Sheet content</Typography> },
  render: (args) => <InteractiveSheet {...args} />,
}
