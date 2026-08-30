import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SectionTemplatePicker } from './SectionTemplatePicker'
import type { SectionTemplate } from './SectionTemplatePicker'

const TEMPLATES: SectionTemplate[] = [
  {
    id: 'traditional',
    title: 'Traditional club',
    description: "Men's and women's open sides, boys' and girls' junior age-groups, and a vets section.",
    roots: [
      { name: 'Open Sides', children: [{ name: 'Men' }, { name: 'Women' }] },
      { name: 'Vets' },
    ],
  },
  {
    id: 'school',
    title: 'School',
    description: 'First and Second XI, plus an age-graded Colts ladder.',
    roots: [{ name: 'First XI' }, { name: 'Colts', children: [{ name: 'U14' }, { name: 'U15' }] }],
  },
]

describe('SectionTemplatePicker', () => {
  it('renders every template with its title, description, and node names', () => {
    render(<SectionTemplatePicker templates={TEMPLATES} onChoose={vi.fn()} onStartBlank={vi.fn()} />)

    expect(screen.getByText('Traditional club')).toBeInTheDocument()
    expect(screen.getByText(/Men's and women's open sides/)).toBeInTheDocument()
    expect(screen.getByText('Open Sides')).toBeInTheDocument()
    expect(screen.getByText('Men')).toBeInTheDocument()
    expect(screen.getByText('Women')).toBeInTheDocument()
    expect(screen.getByText('Vets')).toBeInTheDocument()

    expect(screen.getByText('School')).toBeInTheDocument()
    expect(screen.getByText('First XI')).toBeInTheDocument()
    expect(screen.getByText('Colts')).toBeInTheDocument()
    expect(screen.getByText('U14')).toBeInTheDocument()
    expect(screen.getByText('U15')).toBeInTheDocument()
  })

  it('clicking "Use this template" calls onChoose with that exact template', async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    render(<SectionTemplatePicker templates={TEMPLATES} onChoose={onChoose} onStartBlank={vi.fn()} />)

    const useButtons = screen.getAllByRole('button', { name: 'Use this template' })
    await user.click(useButtons[1])

    expect(onChoose).toHaveBeenCalledWith(TEMPLATES[1])
  })

  it('clicking the blank action calls onStartBlank', async () => {
    const user = userEvent.setup()
    const onStartBlank = vi.fn()
    render(<SectionTemplatePicker templates={TEMPLATES} onChoose={vi.fn()} onStartBlank={onStartBlank} />)

    await user.click(screen.getByRole('button', { name: /start blank/i }))

    expect(onStartBlank).toHaveBeenCalledTimes(1)
  })

  it('shows a "Building…" state on the pending template\'s own card and disables every action while it runs', () => {
    render(
      <SectionTemplatePicker
        templates={TEMPLATES}
        onChoose={vi.fn()}
        onStartBlank={vi.fn()}
        pendingTemplateId="school"
      />,
    )

    expect(screen.getByRole('button', { name: 'Building…' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use this template' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Building…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /start blank/i })).toBeDisabled()
  })
})
