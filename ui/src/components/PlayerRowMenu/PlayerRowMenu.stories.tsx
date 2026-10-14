import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button, MenuItem } from '@mui/material'
import { PlayerRowMenu } from './PlayerRowMenu'

const meta: Meta<typeof PlayerRowMenu> = {
  title: 'Components/PlayerRowMenu',
  component: PlayerRowMenu,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof PlayerRowMenu>

function Demo({ positionLabel }: { positionLabel: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [ids, setIds] = useState(['a', 'b', 'c', 'd'])
  return (
    <>
      <Button variant="outlined" onClick={(event) => setAnchor(event.currentTarget)}>
        {`Order: ${ids.join(' ')}`}
      </Button>
      <PlayerRowMenu
        anchor={anchor}
        onClose={() => setAnchor(null)}
        playerId="b"
        playerName="Bob Birch"
        ids={ids}
        onReorder={setIds}
        positionLabel={positionLabel}
        before={[<MenuItem key="swap">Swap player...</MenuItem>]}
        after={[<MenuItem key="remove" sx={{ color: 'error.main' }}>Remove</MenuItem>]}
      />
    </>
  )
}

export const BattingPosition: Story = { render: () => <Demo positionLabel="Batting position" /> }
export const BowlingPosition: Story = { render: () => <Demo positionLabel="Bowling position" /> }
