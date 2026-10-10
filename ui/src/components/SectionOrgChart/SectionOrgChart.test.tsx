import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SectionOrgChart } from './SectionOrgChart'
import type { Section } from '../../api/sectionApi'

function makeSection(overrides: Partial<Section>): Section {
  return {
    id: 'a',
    clubId: 'c',
    parentSectionId: null,
    name: 'A',
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

const SECTIONS = [
  makeSection({ id: 'juniors', name: 'Juniors' }),
  makeSection({ id: 'u11', name: 'U11', parentSectionId: 'juniors', minAge: 9, maxAge: 11 }),
  makeSection({ id: 'u13', name: 'U13', parentSectionId: 'juniors', active: false }),
  makeSection({ id: 'vets', name: 'Vets' }),
]

function setup(props: Partial<React.ComponentProps<typeof SectionOrgChart>> = {}) {
  const onSelect = vi.fn()
  const onAddChild = vi.fn()
  render(
    <SectionOrgChart sections={SECTIONS} selectedId={null} onSelect={onSelect} onAddChild={onAddChild} {...props} />,
  )
  return { onSelect, onAddChild }
}

describe('SectionOrgChart', () => {
  it('renders nodes, age chips and the Inactive state', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Juniors' })).toBeInTheDocument()
    expect(screen.getByText('9–11')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('selects on click and calls onAddChild from the plus button', async () => {
    const { onSelect, onAddChild } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'U11' }))
    expect(onSelect).toHaveBeenCalledWith('u11')
    await userEvent.click(screen.getByRole('button', { name: 'Add a child section under Vets' }))
    expect(onAddChild).toHaveBeenCalledWith('vets')
  })

  it('selects with Enter and Space', async () => {
    const { onSelect } = setup()
    screen.getByRole('button', { name: 'Vets' }).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it('moves focus with the arrow keys', async () => {
    setup()
    screen.getByRole('button', { name: 'Juniors' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: 'U11' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'U13' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('button', { name: 'U11' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('button', { name: 'Juniors' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Vets' })).toHaveFocus()
  })

  it('calls onClearSelection on Escape', async () => {
    const onClearSelection = vi.fn()
    setup({ onClearSelection })
    screen.getByRole('button', { name: 'Vets' }).focus()
    await userEvent.keyboard('{Escape}')
    expect(onClearSelection).toHaveBeenCalledTimes(1)
  })

  it('renders the toolbar slot only where it returns content', () => {
    setup({ renderNodeToolbar: (s) => (s.id === 'vets' ? <span>Toolbar for Vets</span> : null) })
    expect(screen.getByText('Toolbar for Vets')).toBeInTheDocument()
    expect(screen.getAllByText(/Toolbar for/)).toHaveLength(1)
  })

  it('draws no plus button when onAddChild is omitted', () => {
    setup({ onAddChild: undefined })
    expect(screen.queryByRole('button', { name: /Add a child section/ })).not.toBeInTheDocument()
  })
})
