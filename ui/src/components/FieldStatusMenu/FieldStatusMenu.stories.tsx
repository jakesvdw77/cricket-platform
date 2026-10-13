import { useState } from 'react'
import { Button } from '@mui/material'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FieldStatusMenu } from './FieldStatusMenu'
import type { FieldStatus } from '../../utils/fieldStatus'

const meta: Meta<typeof FieldStatusMenu> = {
  title: 'Components/FieldStatusMenu',
  component: FieldStatusMenu,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof FieldStatusMenu>

function Demo({ status }: { status: FieldStatus }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <Button variant="outlined" onClick={(event) => setAnchor(event.currentTarget)}>
        Status
      </Button>
      <FieldStatusMenu status={status} anchorEl={anchor} onClose={() => setAnchor(null)} onAction={() => undefined} />
    </>
  )
}

// docs/specs/099: the menu only lists the changes valid from the field's current status.
export const Unverified: Story = { render: () => <Demo status="unverified" /> }
// A verified field has no changes; its caller disables the button instead of opening this.
export const Verified: Story = { render: () => <Demo status="verified" /> }
export const Rejected: Story = { render: () => <Demo status="rejected" /> }
