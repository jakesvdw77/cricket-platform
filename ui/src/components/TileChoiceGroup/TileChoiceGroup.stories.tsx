import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TileChoiceGroup } from './TileChoiceGroup'

const meta: Meta<typeof TileChoiceGroup> = {
  title: 'Components/TileChoiceGroup',
  component: TileChoiceGroup,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof TileChoiceGroup>

const options = [
  { value: 'home', content: 'Home side' },
  { value: 'away', content: 'Away side' },
]

function Demo() {
  const [value, setValue] = useState<string | null>('home')
  return <TileChoiceGroup label="Who won?" options={options} value={value} onChange={setValue} columns={{ xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }} tileSx={{ minHeight: 44 }} />
}

export const Default: Story = { render: () => <Demo /> }

export const Disabled: Story = {
  args: { label: 'Who won?', options, value: 'away', onChange: () => {}, disabled: true, columns: '1fr 1fr' },
}

// docs/specs/109-delete-empty-match.md: a control outside the radio, in the tile's corner.
export const WithAdornment: Story = {
  args: {
    label: 'Which match?',
    options: [
      { value: 'a', content: 'Home v Away', adornment: <button type="button">Delete</button> },
      { value: 'b', content: 'Other v Another' },
    ],
    value: 'b',
    onChange: () => {},
    columns: '1fr',
  },
}
