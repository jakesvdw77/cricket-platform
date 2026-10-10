import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddSectionDialog } from './AddSectionDialog'
import type { AddSectionDialogProps } from './AddSectionDialog'
import type { Section } from '../../api/sectionApi'

const PARENT: Section = {
  id: 'boys',
  clubId: 'club-1',
  parentSectionId: 'juniors',
  name: 'Boys',
  minAge: null,
  maxAge: null,
  gender: null,
  active: true,
  createdAt: '',
  updatedAt: '',
  updatedBy: null,
}

function renderDialog(overrides: Partial<AddSectionDialogProps> = {}) {
  const props: AddSectionDialogProps = {
    open: true,
    parent: PARENT,
    parentPath: 'Juniors, Boys',
    onClose: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<AddSectionDialog {...props} />)
  return props
}

describe('AddSectionDialog (docs/specs/094)', () => {
  it('names the parent in the title, or says top-level', () => {
    const { unmount } = render(
      <AddSectionDialog open parent={PARENT} parentPath="Juniors, Boys" onClose={vi.fn()} onCreate={vi.fn()} />,
    )
    expect(screen.getByText('Add a section under Juniors, Boys')).toBeInTheDocument()
    unmount()
    render(<AddSectionDialog open parent={null} onClose={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByText('Add a top-level section')).toBeInTheDocument()
  })

  it('requires a name', async () => {
    const props = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Add Section' }))
    expect(screen.getByText('Enter a name')).toBeInTheDocument()
    expect(props.onCreate).not.toHaveBeenCalled()
  })

  it('blocks an age to below age from', async () => {
    const props = renderDialog()
    await userEvent.type(screen.getByLabelText(/Name/), 'U9')
    await userEvent.type(screen.getByLabelText(/Age from/), '9')
    await userEvent.type(screen.getByLabelText(/Age to/), '6')
    expect(screen.getByText('Age to must not be below age from')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add Section' }))
    expect(props.onCreate).not.toHaveBeenCalled()
  })

  it('sends the full payload under the parent', async () => {
    const props = renderDialog()
    await userEvent.type(screen.getByLabelText(/Name/), '  U9  ')
    await userEvent.type(screen.getByLabelText(/Age from/), '6')
    await userEvent.type(screen.getByLabelText(/Age to/), '9')
    await userEvent.click(screen.getByRole('combobox', { name: 'Gender' }))
    await userEvent.click(screen.getByRole('option', { name: 'Female' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add Section' }))
    expect(props.onCreate).toHaveBeenCalledWith({
      name: 'U9',
      parentSectionId: 'boys',
      minAge: 6,
      maxAge: 9,
      gender: 'FEMALE',
    })
  })

  it('sends nulls for the optional fields and a null parent at top level', async () => {
    const props = renderDialog({ parent: null })
    await userEvent.type(screen.getByLabelText(/Name/), 'Juniors')
    await userEvent.click(screen.getByRole('button', { name: 'Add Section' }))
    expect(props.onCreate).toHaveBeenCalledWith({
      name: 'Juniors',
      parentSectionId: null,
      minAge: null,
      maxAge: null,
      gender: null,
    })
  })

  it('disables both buttons while pending', () => {
    renderDialog({ pending: true })
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('shows an error and cancels', async () => {
    const props = renderDialog({ error: 'That name is taken.' })
    expect(screen.getByRole('alert')).toHaveTextContent('That name is taken.')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onClose).toHaveBeenCalled()
  })
})
