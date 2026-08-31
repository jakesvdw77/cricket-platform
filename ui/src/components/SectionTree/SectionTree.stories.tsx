import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SectionTree } from './SectionTree'
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

// The traditional-club shape from SectionTemplatePicker (025), reused here as a realistic tree —
// deliberately includes the same-named-leaf-in-two-branches case ("1st XI" under both Men and
// Women) this component exists to disambiguate.
const SECTIONS: Section[] = [
  makeSection({ id: 'open', name: 'Open Sides' }),
  makeSection({ id: 'men', name: 'Men', parentSectionId: 'open' }),
  makeSection({ id: 'men-1st', name: '1st XI', parentSectionId: 'men' }),
  makeSection({ id: 'men-2nd', name: '2nd XI', parentSectionId: 'men' }),
  makeSection({ id: 'women', name: 'Women', parentSectionId: 'open' }),
  makeSection({ id: 'women-1st', name: '1st XI', parentSectionId: 'women' }),
  makeSection({ id: 'juniors', name: 'Juniors' }),
  makeSection({ id: 'boys', name: 'Boys', parentSectionId: 'juniors' }),
  makeSection({ id: 'boys-u13', name: 'U13', parentSectionId: 'boys' }),
  makeSection({ id: 'boys-u15', name: 'U15', parentSectionId: 'boys' }),
  makeSection({ id: 'girls', name: 'Girls', parentSectionId: 'juniors' }),
  makeSection({ id: 'girls-u13', name: 'U13', parentSectionId: 'girls' }),
  makeSection({ id: 'girls-u15', name: 'U15', parentSectionId: 'girls' }),
  makeSection({ id: 'vets', name: 'Vets' }),
]

const meta: Meta<typeof SectionTree> = {
  title: 'Components/SectionTree',
  component: SectionTree,
}

export default meta
type Story = StoryObj<typeof SectionTree>

function InteractiveDemo() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  return <SectionTree sections={SECTIONS} selectedId={selectedId} onSelect={setSelectedId} />
}

export const Default: Story = {
  render: () => <InteractiveDemo />,
}

export const WithDisabledNodes: Story = {
  args: {
    sections: SECTIONS,
    selectedId: null,
    onSelect: () => {},
    disabledIds: new Set(['boys-u13', 'girls-u13']),
  },
}

export const Empty: Story = {
  args: {
    sections: [],
    onSelect: () => {},
    emptyMessage: 'No sections yet.',
  },
}
