import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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
  makeSection({ id: 'juniors', name: 'Juniors' }),
  makeSection({ id: 'boys', name: 'Boys', parentSectionId: 'juniors' }),
  makeSection({ id: 'boys-u13', name: 'U13', parentSectionId: 'boys' }),
  makeSection({ id: 'girls', name: 'Girls', parentSectionId: 'juniors' }),
  makeSection({ id: 'girls-u13', name: 'U13', parentSectionId: 'girls' }),
]

function ControlledDemo({ onChange }: { onChange: (id: string) => void }) {
  const [value, setValue] = useState<string | null>(null)
  return (
    <SectionTreeSelect
      label="Section"
      sections={SECTIONS}
      value={value}
      onChange={(id) => {
        setValue(id)
        onChange(id)
      }}
    />
  )
}

describe('SectionTreeSelect', () => {
  it('opens the tree popover on click and is closed by default', async () => {
    const user = userEvent.setup()
    render(<SectionTreeSelect label="Section" sections={SECTIONS} value={null} onChange={vi.fn()} />)

    expect(screen.queryByText('Boys')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Section'))

    expect(screen.getByText('Boys')).toBeInTheDocument()
    expect(screen.getAllByText('U13')).toHaveLength(2)
  })

  it('picking a node calls onChange with its id and closes the popover', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SectionTreeSelect label="Section" sections={SECTIONS} value={null} onChange={onChange} />)

    await user.click(screen.getByLabelText('Section'))
    await user.click(screen.getAllByText('U13')[0])

    expect(onChange).toHaveBeenCalledWith('boys-u13')
  })

  it('once a value is selected, the closed field shows the full breadcrumb path, not just the leaf name', async () => {
    const user = userEvent.setup()
    render(<ControlledDemo onChange={vi.fn()} />)

    await user.click(screen.getByLabelText('Section'))
    await user.click(screen.getAllByText('U13')[0])

    expect(screen.getByLabelText('Section')).toHaveValue('Juniors › Boys › U13')
  })

  it('the field is read-only — typing does not change its value', async () => {
    const user = userEvent.setup()
    render(<SectionTreeSelect label="Section" sections={SECTIONS} value={null} onChange={vi.fn()} />)

    const field = screen.getByLabelText('Section')
    await user.type(field, 'hello')

    expect(field).toHaveValue('')
  })
})
