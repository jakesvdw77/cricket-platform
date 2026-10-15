import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CountField, WicketsField } from './IntegerField'

const meta: Meta = { title: 'Components/IntegerField' }
export default meta

function CountDemo() {
  const [value, setValue] = useState<number | null>(7)
  return <CountField ariaLabel="Maidens" label="Maidens" value={value} onChange={setValue} />
}

function WicketsDemo() {
  const [value, setValue] = useState<number | null>(4)
  return <WicketsField ariaLabel="Wickets" label="Wickets" value={value} onChange={setValue} />
}

export const Field: StoryObj = { render: () => <CountDemo /> }
export const Wickets: StoryObj = { render: () => <WicketsDemo /> }
