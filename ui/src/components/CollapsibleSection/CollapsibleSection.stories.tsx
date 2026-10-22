import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Typography } from '@mui/material'
import { CollapsibleSection } from './CollapsibleSection'
import type { CollapsibleSectionProps } from './CollapsibleSection'

function Stateful(props: Omit<CollapsibleSectionProps, 'open' | 'onToggle'> & { initiallyOpen: boolean }) {
  const { initiallyOpen, ...rest } = props
  const [open, setOpen] = useState(initiallyOpen)
  return <CollapsibleSection {...rest} open={open} onToggle={() => setOpen((value) => !value)} />
}

const meta: Meta<typeof Stateful> = {
  title: 'Components/CollapsibleSection',
  component: Stateful,
  args: {
    title: 'Batting',
    testId: 'batting',
    initiallyOpen: true,
    children: <Typography>Three cards go here.</Typography>,
  },
}
export default meta

type Story = StoryObj<typeof Stateful>

export const Open: Story = {}

export const Collapsed: Story = { args: { initiallyOpen: false } }

export const WithDescription: Story = { args: { title: 'Overview', testId: 'overview', buttonVariant: 'outlined', description: 'Same filters as above · 5 charts' } }
