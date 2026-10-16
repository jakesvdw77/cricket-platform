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

  describe('with a section age limit (Under 15)', () => {
    const under15 = { name: 'U15', minAge: null, maxAge: 15 }

    it('narrows the date input, says the window and prefills nothing', () => {
      setup({ section: under15 })
      const input = screen.getByLabelText('Date of birth')
      expect(input).toHaveValue('')
      expect(input).toHaveAttribute('min')
      expect(input.getAttribute('min')).not.toBe('1900-01-01')
      expect(input.getAttribute('max')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(screen.getByText(/^Under 15: born on or after \d{1,2} \w{3} \d{4}$/)).toBeInTheDocument()
    })

    it('warns in amber about a date outside the range but still submits', async () => {
      const user = userEvent.setup()
      const onSubmit = setup({ section: under15, initialFirstName: 'Jan', initialLastName: 'Berg' })
      await user.type(screen.getByLabelText('Date of birth'), '2000-01-01')
      expect(screen.getByRole('status')).toHaveTextContent("This date is outside the section's age range.")
      await user.click(screen.getByRole('button', { name: 'Create and link' }))
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dateOfBirth: '2000-01-01' }))
    })

    it('shows no note for a date inside the range', async () => {
      const user = userEvent.setup()
      setup({ section: under15 })
      const input = screen.getByLabelText('Date of birth')
      await user.type(input, input.getAttribute('max') as string)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  it("uses the server's reference date and the league's limits for min, max and the helper line", () => {
    setup({
      section: { name: 'U15', minAge: null, maxAge: 15 },
      league: { minAge: null, maxAge: 13 },
      referenceDate: '2020-09-01',
    })
    const input = screen.getByLabelText('Date of birth')
    expect(input).toHaveAttribute('min', '2007-09-02')
    expect(input).toHaveAttribute('max', '2020-09-01')
    expect(screen.getByText('Under 13 on 1 Sep 2020: born on or after 2 Sep 2007')).toBeInTheDocument()
  })

  it('without a section or with no age limits behaves as before', () => {
    setup({ section: { name: 'Open', minAge: null, maxAge: null } })
    const input = screen.getByLabelText('Date of birth')
    expect(input).toHaveAttribute('min', '1900-01-01')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
