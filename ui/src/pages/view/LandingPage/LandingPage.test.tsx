import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
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
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
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

    expect(await screen.findByText("Thanks, we'll be in touch")).toBeInTheDocument()
  })
})

describe('LandingPage login dialog', () => {
  it('opens the login dialog when "Log in" is clicked, and closes it via the close icon', async () => {
    const user = userEvent.setup()
    renderLandingPage()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const dialog = await screen.findByRole('dialog')
    expect(screen.getByText('Log in to your club')).toBeInTheDocument()

    expect(screen.getByRole('combobox', { name: 'Search for your club' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Platform admin? Log in here' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })
})

describe('LandingPage content', () => {
  it('shows the approved headline, the three offer cards, the real-club band, the on-the-way list and the footer', () => {
    renderLandingPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Run your cricket club from one place' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What your club gets' })).toBeInTheDocument()
    for (const title of ['Run the season', 'Pick the team', 'Know your people']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { name: 'Made with Irene Villagers Cricket Club' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'On the way' })).toBeInTheDocument()
    for (const title of ['Messages to your club', 'A home page for each club', 'Player schedule and stats', 'Photo gallery']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    expect(screen.getByText('© Cricket Legend')).toBeInTheDocument()
    expect(screen.getByText('Set up by hand for each club')).toBeInTheDocument()
  })

  it('makes no invented claims: no testimonials, social links, membership, live scoring or customer heading', () => {
    renderLandingPage()

    expect(screen.queryByText(/Clubs already using the platform/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Riaan Coetzee|Devan Pillay|Sarah Mokoena/)).not.toBeInTheDocument()
    expect(screen.queryByText(/membership|live scoring/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /facebook|instagram|linkedin/i })).not.toBeInTheDocument()
  })

  it('offers the three in-page anchors and sets the document title', () => {
    renderLandingPage()

    expect(screen.getAllByRole('link', { name: 'Get started' })[0]).toHaveAttribute('href', '#lead-capture')
    expect(screen.getByRole('link', { name: 'What you get' })).toHaveAttribute('href', '#offer')
    expect(screen.getByRole('link', { name: 'On the way' })).toHaveAttribute('href', '#soon')
    expect(document.title).toBe('Cricket Legend | Run your cricket club from one place')
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute('content', expect.stringContaining('team selection'))
  })

  it('draws the Cricket Legend mark on its own green tile, not a white one', () => {
    renderLandingPage()

    expect(screen.getByTestId('brand-mark')).toHaveAttribute('src', '/favicon.svg')
  })
})
