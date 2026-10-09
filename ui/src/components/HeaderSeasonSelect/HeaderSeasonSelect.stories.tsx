import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HeaderSeasonSelect } from './HeaderSeasonSelect'

const meta: Meta<typeof HeaderSeasonSelect> = {
  title: 'Components/HeaderSeasonSelect',
  component: HeaderSeasonSelect,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof HeaderSeasonSelect>

const seasons = [
  { id: 's1', name: '2026/2027' },
  { id: 's2', name: '2025/2026' },
]

function Demo({ initial }: { initial: string | null }) {
  const [value, setValue] = useState<string | null>(initial)
  return <HeaderSeasonSelect seasons={seasons} value={value} onChange={setValue} />
}

export const OneSeason: Story = { render: () => <Demo initial="s1" /> }

export const AllSeasons: Story = { render: () => <Demo initial={null} /> }
