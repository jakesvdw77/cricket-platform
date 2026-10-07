import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IdentifyForm } from './IdentifyForm'

async function fillDate(day: string, month: string, year: string) {
  const user = userEvent.setup()
  if (day) await user.type(screen.getByLabelText('Day'), day)
  if (month) await user.type(screen.getByLabelText('Month'), month)
  if (year) await user.type(screen.getByLabelText('Year'), year)
  return user
}

describe('IdentifyForm', () => {
  it('submits trimmed names and an ISO date of birth', async () => {
    const onSubmit = vi.fn()
    render(<IdentifyForm onSubmit={onSubmit} />)
    const user = await fillDate('4', '3', '1985')
    await user.type(screen.getByLabelText('First name'), ' Liam ')
    await user.type(screen.getByLabelText('Surname'), 'Carter')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onSubmit).toHaveBeenCalledWith({ firstName: 'Liam', lastName: 'Carter', dateOfBirth: '1985-03-04' })
  })

  it('validates empty names and date before submitting', async () => {
    const onSubmit = vi.fn()
    render(<IdentifyForm onSubmit={onSubmit} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Enter your first name.')).toBeInTheDocument()
    expect(screen.getByText('Enter your surname.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the day, month and year.')
  })

  it('shows a date error for an impossible date', async () => {
    const onSubmit = vi.fn()
    render(<IdentifyForm onSubmit={onSubmit} initialFirstName="Liam" initialLastName="Carter" />)
    const user = await fillDate('31', '2', '1985')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('That date does not exist')
  })

  it('shows the generic failure with tries left', () => {
    render(<IdentifyForm onSubmit={vi.fn()} failed triesLeft={3} />)
    expect(screen.getByText(/We could not find a player with those details in this poll\. .* 3 tries left\./)).toBeInTheDocument()
  })

  it('uses the singular for one try left and omits the count at zero or unknown', () => {
    const { rerender } = render(<IdentifyForm onSubmit={vi.fn()} failed triesLeft={1} />)
    expect(screen.getByText(/1 try left\./)).toBeInTheDocument()
    rerender(<IdentifyForm onSubmit={vi.fn()} failed triesLeft={0} />)
    expect(screen.queryByText(/left\./)).not.toBeInTheDocument()
    rerender(<IdentifyForm onSubmit={vi.fn()} failed />)
    expect(screen.queryByText(/left\./)).not.toBeInTheDocument()
  })

  it('shows another error and a notice', () => {
    render(<IdentifyForm onSubmit={vi.fn()} errorMessage="Something went wrong." notice="Your 30 minutes ran out." />)
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    expect(screen.getByText('Your 30 minutes ran out.')).toBeInTheDocument()
  })

  it('replaces the form with the locked message and the retry time', () => {
    render(<IdentifyForm onSubmit={vi.fn()} locked={{ retryAfterSeconds: 900 }} />)
    expect(screen.getByText('Please try again later')).toBeInTheDocument()
    expect(screen.getByText(/try again in 15 minutes/)).toBeInTheDocument()
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
  })

  it('locked without a known time still reads friendly', () => {
    render(<IdentifyForm onSubmit={vi.fn()} locked={{}} />)
    expect(screen.getByText(/Please try again later, or ask your manager/)).toBeInTheDocument()
  })

  it('offers a way back from the locked screen when given a handler', async () => {
    const onTryAgain = vi.fn()
    render(<IdentifyForm onSubmit={vi.fn()} locked={{}} onTryAgain={onTryAgain} />)
    await userEvent.click(screen.getByRole('button', { name: 'Try different details' }))
    expect(onTryAgain).toHaveBeenCalled()
  })

  it('shows the no date of birth message and a way back', async () => {
    const onTryAgain = vi.fn()
    render(<IdentifyForm onSubmit={vi.fn()} noDateOfBirth onTryAgain={onTryAgain} />)
    expect(screen.getByText(/not on record yet/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try different details' }))
    expect(onTryAgain).toHaveBeenCalled()
  })

  it('asks only the date for a remembered player, with Not you?', async () => {
    const onSubmit = vi.fn()
    const onNotYou = vi.fn()
    render(
      <IdentifyForm onSubmit={onSubmit} initialFirstName="Liam" initialLastName="Carter" nameLocked onNotYou={onNotYou} />,
    )
    expect(screen.getByText('Hi Liam, confirm it is you')).toBeInTheDocument()
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
    const user = await fillDate('14', '3', '1985')
    await user.click(screen.getByRole('button', { name: 'Not you?' }))
    expect(onNotYou).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onSubmit).toHaveBeenCalledWith({ firstName: 'Liam', lastName: 'Carter', dateOfBirth: '1985-03-14' })
  })

  it('disables Continue while submitting', () => {
    render(<IdentifyForm onSubmit={vi.fn()} submitting />)
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled()
  })
})
