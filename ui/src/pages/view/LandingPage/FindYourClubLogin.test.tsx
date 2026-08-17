import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FindYourClubLogin from './FindYourClubLogin'

const searchClubs = vi.fn()

vi.mock('../../../api/leadApi', () => ({
  searchClubs: (...args: unknown[]) => searchClubs(...args),
}))

function renderFindYourClubLogin() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<FindYourClubLogin />} />
          <Route path="/login" element={<div>Login route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FindYourClubLogin', () => {
  beforeEach(() => {
    searchClubs.mockReset()
  })

  it('shows matching clubs as the user types a search query', async () => {
    searchClubs.mockResolvedValue([{ name: 'Riverside CC', slug: 'riverside' }])
    const user = userEvent.setup()
    renderFindYourClubLogin()

    await user.type(screen.getByLabelText('Search for your club'), 'river')

    expect(await screen.findByText('Riverside CC')).toBeInTheDocument()
    expect(screen.getByText('riverside')).toBeInTheDocument()
  })

  it('navigates the browser to the selected club\'s subdomain login on click', async () => {
    searchClubs.mockResolvedValue([{ name: 'Riverside CC', slug: 'riverside' }])
    const user = userEvent.setup()

    const originalLocation = window.location
    // jsdom's window.location isn't directly assignable — redefine it as a writable stub so
    // FindYourClubLogin's `window.location.href = ...` real navigation can be observed instead
    // of actually navigating (which jsdom doesn't support anyway).
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, href: originalLocation.href },
    })

    try {
      renderFindYourClubLogin()

      await user.type(screen.getByLabelText('Search for your club'), 'river')
      await user.click(await screen.findByText('Riverside CC'))

      expect(window.location.href).toBe(`${originalLocation.protocol}//riverside.localhost:5173/login`)
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: originalLocation,
      })
    }
  })

  it('navigates to /login when "No club? Log in as admin" is clicked, without requiring a club search', async () => {
    const user = userEvent.setup()
    renderFindYourClubLogin()

    await user.click(screen.getByRole('button', { name: 'No club? Log in as admin' }))

    await waitFor(() => expect(screen.getByText('Login route')).toBeInTheDocument())
    expect(searchClubs).not.toHaveBeenCalled()
  })
})
