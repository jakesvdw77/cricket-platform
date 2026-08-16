import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import LandingPage from './LandingPage'

const submitLead = vi.fn()

vi.mock('../../../api/leadApi', () => ({
  submitLead: (...args: unknown[]) => submitLead(...args),
  searchClubs: vi.fn().mockResolvedValue([]),
}))

function renderLandingPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <LandingPage />
    </QueryClientProvider>,
  )
}

describe('LandingPage lead-capture form', () => {
  it('shows inline validation errors and does not submit when required fields are missing', async () => {
    const user = userEvent.setup()
    renderLandingPage()

    await user.click(screen.getByRole('button', { name: 'Get started' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Club name is required')).toBeInTheDocument()
    expect(submitLead).not.toHaveBeenCalled()
  })

  it('shows an inline error for a malformed email and does not submit', async () => {
    const user = userEvent.setup()
    renderLandingPage()

    await user.type(screen.getByLabelText('Name'), 'Riaan Coetzee')
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Club name'), 'Riverside CC')

    await user.click(screen.getByRole('button', { name: 'Get started' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(submitLead).not.toHaveBeenCalled()
  })

  it('submits successfully with valid data', async () => {
    submitLead.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderLandingPage()

    await user.type(screen.getByLabelText('Name'), 'Riaan Coetzee')
    await user.type(screen.getByLabelText('Email'), 'riaan@riverside.example')
    await user.type(screen.getByLabelText('Club name'), 'Riverside CC')

    await user.click(screen.getByRole('button', { name: 'Get started' }))

    await waitFor(() => expect(submitLead).toHaveBeenCalledWith({
      name: 'Riaan Coetzee',
      email: 'riaan@riverside.example',
      clubName: 'Riverside CC',
      phone: undefined,
      message: undefined,
    }))

    expect(await screen.findByText("Thanks — we'll be in touch")).toBeInTheDocument()
  })
})
