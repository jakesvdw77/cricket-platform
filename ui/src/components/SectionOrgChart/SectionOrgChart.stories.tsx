import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { SectionOrgChart } from './SectionOrgChart'
import type { Section } from '../../api/sectionApi'

function section(overrides: Partial<Section>): Section {
  return {
    id: 'root',
    clubId: 'club-1',
    parentSectionId: null,
    name: 'Root',
    minAge: null,
    maxAge: null,
    gender: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

const SAMPLE_SECTIONS: Section[] = [
  section({ id: 'open', name: 'Open Sides' }),
  section({ id: 'men', name: 'Men', parentSectionId: 'open' }),
  section({ id: 'women', name: 'Women', parentSectionId: 'open' }),
  section({ id: 'juniors', name: 'Juniors' }),
  section({ id: 'boys', name: 'Boys', parentSectionId: 'juniors' }),
  section({ id: 'b11', name: 'U11', parentSectionId: 'boys' }),
  section({ id: 'b13', name: 'U13', parentSectionId: 'boys' }),
  section({ id: 'b15', name: 'U15', parentSectionId: 'boys' }),
  section({ id: 'b9', name: 'U/9', parentSectionId: 'boys', minAge: 6, maxAge: 9 }),
  section({ id: 'girls', name: 'Girls', parentSectionId: 'juniors' }),
  section({ id: 'g13', name: 'U13', parentSectionId: 'girls' }),
  section({ id: 'g15', name: 'U15', parentSectionId: 'girls', active: false }),
  section({ id: 'vets', name: 'Vets' }),
  section({ id: 'o40', name: 'Over 40', parentSectionId: 'vets', minAge: 40 }),
]

const meta: Meta<typeof SectionOrgChart> = {
  title: 'Components/SectionOrgChart',
  component: SectionOrgChart,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof SectionOrgChart>

function Interactive({ width }: { width?: number }) {
  const [selectedId, setSelectedId] = useState<string | null>('b9')
  return (
    <Box sx={{ width, maxWidth: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
      <SectionOrgChart
        sections={SAMPLE_SECTIONS}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAddChild={() => undefined}
        onClearSelection={() => setSelectedId(null)}
      />
    </Box>
  )
}

export const Default: Story = { render: () => <Interactive /> }

export const WithToolbar: Story = {
  render: () => (
    <SectionOrgChart
      sections={SAMPLE_SECTIONS}
      selectedId="men"
      onSelect={() => undefined}
      onAddChild={() => undefined}
      renderNodeToolbar={(s) => (s.id === 'men' ? <Box sx={{ px: 1.5, py: 0.5, fontSize: 12 }}>Toolbar</Box> : null)}
    />
  ),
}

export const Width375: Story = { render: () => <Interactive width={375} /> }
export const Width768: Story = { render: () => <Interactive width={768} /> }
export const Width1280: Story = { render: () => <Interactive width={1280} /> }
