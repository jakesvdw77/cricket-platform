import { useState } from 'react'
import { Box } from '@mui/material'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SectionTreeSelect } from './SectionTreeSelect'
import type { Section } from '../../api/sectionApi'

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 'section-1',
    clubId: 'club-1',
    parentSectionId: null,
    name: 'Section',
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

const SECTIONS: Section[] = [
  makeSection({ id: 'open', name: 'Open Sides' }),
  makeSection({ id: 'men', name: 'Men', parentSectionId: 'open' }),
  makeSection({ id: 'men-1st', name: '1st XI', parentSectionId: 'men' }),
  makeSection({ id: 'women', name: 'Women', parentSectionId: 'open' }),
  makeSection({ id: 'women-1st', name: '1st XI', parentSectionId: 'women' }),
  makeSection({ id: 'juniors', name: 'Juniors' }),
  makeSection({ id: 'boys', name: 'Boys', parentSectionId: 'juniors' }),
  makeSection({ id: 'boys-u13', name: 'U13', parentSectionId: 'boys' }),
  makeSection({ id: 'girls', name: 'Girls', parentSectionId: 'juniors' }),
  makeSection({ id: 'girls-u13', name: 'U13', parentSectionId: 'girls' }),
]

const meta: Meta<typeof SectionTreeSelect> = {
  title: 'Components/SectionTreeSelect',
  component: SectionTreeSelect,
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 320 }}>
        <Story />
      </Box>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SectionTreeSelect>

function InteractiveDemo() {
  const [value, setValue] = useState<string | null>(null)
  return <SectionTreeSelect label="Section" sections={SECTIONS} value={value} onChange={setValue} />
}

export const Empty: Story = {
  render: () => <InteractiveDemo />,
}

export const WithValueSelected: Story = {
  args: {
    label: 'Section',
    sections: SECTIONS,
    value: 'boys-u13',
    onChange: () => {},
  },
}

export const WithError: Story = {
  args: {
    label: 'Section',
    sections: SECTIONS,
    value: null,
    onChange: () => {},
    error: true,
    helperText: 'Section is required',
  },
}
