import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlayerQuickForm } from './PlayerQuickForm'

function setup(props: Partial<React.ComponentProps<typeof PlayerQuickForm>> = {}) {
  const onSubmit = vi.fn()
  render(<PlayerQuickForm submitLabel="Create and link" onSubmit={onSubmit} {...props} />)
  return onSubmit
}

describe('PlayerQuickForm', () => {
  it('is prefilled with the names and leaves the date of birth empty', () => {
    setup({ initialFirstName: 'Jan', initialLastName: 'van der Berg' })
    expect(screen.getByLabelText('First name')).toHaveValue('Jan')
    expect(screen.getByLabelText('Last name')).toHaveValue('van der Berg')
    expect(screen.getByLabelText('Date of birth')).toHaveValue('')
  })

  it('requires a date of birth and does not submit without it', async () => {
    const user = userEvent.setup()
    const onSubmit = setup({ initialFirstName: 'Jan', initialLastName: 'Berg' })
    await user.click(screen.getByRole('button', { name: 'Create and link' }))
    expect(await screen.findByText('Date of birth is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('requires both names', async () => {
    const user = userEvent.setup()
    const onSubmit = setup()
    await user.click(screen.getByRole('button', { name: 'Create and link' }))
    expect(await screen.findByText('First name is required')).toBeInTheDocument()
    expect(screen.getByText('Last name is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed values once valid', async () => {
    const user = userEvent.setup()
    const onSubmit = setup({ initialFirstName: ' Jan ', initialLastName: 'Berg' })
    await user.type(screen.getByLabelText('Date of birth'), '2010-04-12')
    await user.click(screen.getByRole('button', { name: 'Create and link' }))
    expect(onSubmit).toHaveBeenCalledWith({ firstName: 'Jan', lastName: 'Berg', dateOfBirth: '2010-04-12' })
  })

  it('shows a server error and a saving state', () => {
    setup({ error: 'Already exists.', pending: true })
    expect(screen.getByRole('alert')).toHaveTextContent('Already exists.')
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })
})
