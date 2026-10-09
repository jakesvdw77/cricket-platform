import { useState } from 'react'
import { Button } from '@mui/material'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlayerStatusMenu } from './PlayerStatusMenu'
import type { PlayerStatus } from '../../utils/playerStatus'

const meta: Meta<typeof PlayerStatusMenu> = {
  title: 'Components/PlayerStatusMenu',
  component: PlayerStatusMenu,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof PlayerStatusMenu>

function Demo({ status }: { status: PlayerStatus }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <Button variant="outlined" onClick={(event) => setAnchor(event.currentTarget)}>
        Status
      </Button>
      <PlayerStatusMenu status={status} anchorEl={anchor} onClose={() => setAnchor(null)} onAction={() => undefined} />
    </>
  )
}

// docs/specs/088: the menu only ever lists the changes that are valid from the player's current status.
export const Unverified: Story = { render: () => <Demo status="unverified" /> }
export const Verified: Story = { render: () => <Demo status="verified" /> }
export const Rejected: Story = { render: () => <Demo status="rejected" /> }
export const Suspended: Story = { render: () => <Demo status="suspended" /> }
