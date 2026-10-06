import { useState } from 'react'
import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '@mui/material'
import { MenuSheet } from './MenuSheet'
import { MANAGER_NAV } from '../ManagerShell/managerNav'

const meta: Meta<typeof MenuSheet> = {
  title: 'Components/MenuSheet',
  component: MenuSheet,
  parameters: { layout: 'fullscreen', viewport: { defaultViewport: 'mobile' } },
}
export default meta

type Story = StoryObj<typeof MenuSheet>

function InteractiveSheet(args: ComponentProps<typeof MenuSheet>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open menu</Button>
      <MenuSheet {...args} open={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} />
    </>
  )
}

export const Open: Story = {
  args: { open: true, onOpen: () => {}, onClose: () => {}, groups: MANAGER_NAV },
}

export const WithPollsBadge: Story = {
  args: { open: true, onOpen: () => {}, onClose: () => {}, groups: MANAGER_NAV, badges: { polls: 3 } },
}

export const Interactive: Story = {
  args: { open: false, onOpen: () => {}, onClose: () => {}, groups: MANAGER_NAV },
  render: (args) => <InteractiveSheet {...args} />,
}
