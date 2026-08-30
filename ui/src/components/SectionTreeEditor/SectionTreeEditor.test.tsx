import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

describe('SectionTreeEditor', () => {
  it('renders an empty-tree message when there are no sections', () => {
    render(
      <SectionTreeEditor
        sections={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onAddChild={vi.fn()}
        onRemove={vi.fn()}
      />,
    )

    expect(screen.getByText(/no sections yet/i)).toBeInTheDocument()
  })

  it('builds a tree from a flat array with multiple levels', () => {
    // Mirrors the spec's own worked example: a root, a mid-level branch, two leaves.
    const sections = [
      section({ id: 'juniors', name: 'Juniors', parentSectionId: null }),
      section({ id: 'u13', name: 'U13', parentSectionId: 'juniors' }),
      section({ id: 'u13a', name: 'U13A', parentSectionId: 'u13' }),
      section({ id: 'u13b', name: 'U13B', parentSectionId: 'u13' }),
      section({ id: 'seniors', name: 'Seniors', parentSectionId: null }),
    ]

    render(
      <SectionTreeEditor
        sections={sections}
        selectedId={null}
        onSelect={vi.fn()}
        onAddChild={vi.fn()}
        onRemove={vi.fn()}
      />,
    )

    expect(screen.getByText('Juniors')).toBeInTheDocument()
    expect(screen.getByText('U13')).toBeInTheDocument()
    expect(screen.getByText('U13A')).toBeInTheDocument()
    expect(screen.getByText('U13B')).toBeInTheDocument()
    expect(screen.getByText('Seniors')).toBeInTheDocument()
  })

  it('clicking a node calls onSelect with the right id', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const sections = [
      section({ id: 'juniors', name: 'Juniors', parentSectionId: null }),
      section({ id: 'u13', name: 'U13', parentSectionId: 'juniors' }),
    ]

    render(
      <SectionTreeEditor
        sections={sections}
        selectedId={null}
        onSelect={onSelect}
        onAddChild={vi.fn()}
        onRemove={vi.fn()}
      />,
    )

    await user.click(screen.getByText('U13'))
    expect(onSelect).toHaveBeenCalledWith('u13')
  })

  it('clicking a node’s add-child button calls onAddChild with that node’s id', async () => {
    const user = userEvent.setup()
    const onAddChild = vi.fn()
    const sections = [section({ id: 'juniors', name: 'Juniors', parentSectionId: null })]

    render(
      <SectionTreeEditor
        sections={sections}
        selectedId={null}
        onSelect={vi.fn()}
        onAddChild={onAddChild}
        onRemove={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Add a child section under Juniors' }))
    expect(onAddChild).toHaveBeenCalledWith('juniors')
  })

  it('clicking "Add top-level section" calls onAddChild with null', async () => {
    const user = userEvent.setup()
    const onAddChild = vi.fn()
    const sections = [section({ id: 'juniors', name: 'Juniors', parentSectionId: null })]

    render(
      <SectionTreeEditor
        sections={sections}
        selectedId={null}
        onSelect={vi.fn()}
        onAddChild={onAddChild}
        onRemove={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /add top-level section/i }))
    expect(onAddChild).toHaveBeenCalledWith(null)
  })

  it('disables remove (with an explanatory tooltip) for a selected node that has an active child', async () => {
    const user = userEvent.setup()
    const sections = [
      section({ id: 'juniors', name: 'Juniors', parentSectionId: null }),
      section({ id: 'u13', name: 'U13', parentSectionId: 'juniors' }),
    ]

    render(
      <SectionTreeEditor
        sections={sections}
        selectedId="juniors"
        onSelect={vi.fn()}
        onAddChild={vi.fn()}
        onRemove={vi.fn()}
      />,
    )

    const removeButton = screen.getByRole('button', { name: 'Remove Juniors' })
    expect(removeButton).toBeDisabled()

    // A disabled <button> can't itself receive pointer events for MUI's Tooltip, so it wraps a
    // <span> to host the hover — hovering that span surfaces the explanatory tooltip text.
    await user.hover(removeButton.closest('span')!)
    expect(await screen.findByText(/active sub-section/i)).toBeInTheDocument()
  })

  it('enables remove for a selected node with no active children, and calls onRemove with its id', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const sections = [section({ id: 'juniors', name: 'Juniors', parentSectionId: null })]

    render(
      <SectionTreeEditor
        sections={sections}
        selectedId="juniors"
        onSelect={vi.fn()}
        onAddChild={vi.fn()}
        onRemove={onRemove}
      />,
    )

    const removeButton = screen.getByRole('button', { name: 'Remove Juniors' })
    expect(removeButton).toBeEnabled()

    await user.click(removeButton)
    expect(onRemove).toHaveBeenCalledWith('juniors')
  })

  it('enables remove for a selected node whose only children are inactive', () => {
    // Children being inactive doesn't block the parent.
    const sections = [
      section({ id: 'juniors', name: 'Juniors', parentSectionId: null }),
      section({ id: 'u13', name: 'U13', parentSectionId: 'juniors', active: false }),
    ]

    render(
      <SectionTreeEditor
        sections={sections}
        selectedId="juniors"
        onSelect={vi.fn()}
        onAddChild={vi.fn()}
        onRemove={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Remove Juniors' })).toBeEnabled()
  })

  it('renders an inactive node visually distinct with an "Inactive" label', () => {
    const sections = [section({ id: 'juniors', name: 'Juniors', parentSectionId: null, active: false })]

    render(
      <SectionTreeEditor
        sections={sections}
        selectedId={null}
        onSelect={vi.fn()}
        onAddChild={vi.fn()}
        onRemove={vi.fn()}
      />,
    )

    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('does not render an "Inactive" label for an active node', () => {
    const sections = [section({ id: 'juniors', name: 'Juniors', parentSectionId: null, active: true })]

    render(
      <SectionTreeEditor
        sections={sections}
        selectedId={null}
        onSelect={vi.fn()}
        onAddChild={vi.fn()}
        onRemove={vi.fn()}
      />,
    )

    expect(screen.queryByText('Inactive')).not.toBeInTheDocument()
  })

  it('clicking the rename control on a selected node calls onRenameStart with its id', async () => {
    const user = userEvent.setup()
    const onRenameStart = vi.fn()
    const sections = [section({ id: 'juniors', name: 'Juniors', parentSectionId: null })]

    render(
      <SectionTreeEditor
        sections={sections}
        selectedId="juniors"
        onSelect={vi.fn()}
        onAddChild={vi.fn()}
        onRemove={vi.fn()}
        onRenameStart={onRenameStart}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Rename Juniors' }))
    expect(onRenameStart).toHaveBeenCalledWith('juniors')
  })
})
