import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SectionTreeEditor } from './SectionTreeEditor'
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
  section({ id: 'open-sides', name: 'Open Sides', parentSectionId: null }),
  section({ id: '1st-xi', name: '1st XI', parentSectionId: 'open-sides' }),
  section({ id: '2nd-xi', name: '2nd XI', parentSectionId: 'open-sides' }),
  section({ id: 'juniors', name: 'Juniors', parentSectionId: null }),
  section({ id: 'u13', name: 'U13', parentSectionId: 'juniors', minAge: 11, maxAge: 13 }),
  section({ id: 'u15', name: 'U15', parentSectionId: 'juniors', minAge: 14, maxAge: 15, active: false }),
  section({ id: 'vets', name: 'Vets', parentSectionId: null }),
]

const meta: Meta<typeof SectionTreeEditor> = {
  title: 'Components/SectionTreeEditor',
  component: SectionTreeEditor,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof SectionTreeEditor>

function InteractiveTree() {
  const [selectedId, setSelectedId] = useState<string | null>('u13')
  return (
    <SectionTreeEditor
      sections={SAMPLE_SECTIONS}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onAddChild={() => undefined}
      onRemove={() => undefined}
    />
  )
}

export const Default: Story = {
  render: () => <InteractiveTree />,
}

export const Empty: Story = {
  args: {
    sections: [],
    selectedId: null,
    onSelect: () => undefined,
    onAddChild: () => undefined,
    onRemove: () => undefined,
  },
}

export const BlockedRemove: Story = {
  args: {
    sections: SAMPLE_SECTIONS,
    selectedId: 'juniors',
    onSelect: () => undefined,
    onAddChild: () => undefined,
    onRemove: () => undefined,
  },
}

// docs/standards/design-system.md's Storybook rule — a viewport story at 375/768/1280.
export const MobileViewport: Story = {
  render: () => <InteractiveTree />,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  render: () => <InteractiveTree />,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  render: () => <InteractiveTree />,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
