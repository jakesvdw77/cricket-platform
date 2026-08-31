import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

// Two branches deliberately reuse the same leaf name ("U13" under both Boys and Girls) — the
// exact real-world shape that made a flat list ambiguous and motivated this tree in the first
// place.
const JUNIORS: Section[] = [
  makeSection({ id: 'juniors', name: 'Juniors' }),
  makeSection({ id: 'boys', name: 'Boys', parentSectionId: 'juniors' }),
  makeSection({ id: 'boys-u13', name: 'U13', parentSectionId: 'boys' }),
  makeSection({ id: 'girls', name: 'Girls', parentSectionId: 'juniors' }),
  makeSection({ id: 'girls-u13', name: 'U13', parentSectionId: 'girls' }),
]

describe('SectionTree', () => {
  it('renders every section, with both same-named leaves visible as distinct nodes', () => {
    render(<SectionTree sections={JUNIORS} onSelect={vi.fn()} />)

    expect(screen.getByText('Juniors')).toBeInTheDocument()
    expect(screen.getByText('Boys')).toBeInTheDocument()
    expect(screen.getByText('Girls')).toBeInTheDocument()
    expect(screen.getAllByText('U13')).toHaveLength(2)
  })

  it('starts fully expanded — a leaf is visible without any click', () => {
    render(<SectionTree sections={JUNIORS} onSelect={vi.fn()} />)

    expect(screen.getAllByText('U13')[0]).toBeVisible()
  })

  it('calls onSelect with the clicked node id', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<SectionTree sections={JUNIORS} onSelect={onSelect} />)

    await user.click(screen.getAllByText('U13')[0])

    expect(onSelect).toHaveBeenCalledWith('boys-u13')
  })

  it('renders a disabled id as non-interactive rather than removing it from the tree', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<SectionTree sections={JUNIORS} onSelect={onSelect} disabledIds={new Set(['boys-u13'])} />)

    const disabledNode = screen.getAllByText('U13')[0]
    expect(disabledNode).toBeInTheDocument()
    await user.click(disabledNode)

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows an empty message when there are no sections yet', () => {
    render(<SectionTree sections={[]} onSelect={vi.fn()} emptyMessage="No sections yet." />)

    expect(screen.getByText('No sections yet.')).toBeInTheDocument()
  })
})
