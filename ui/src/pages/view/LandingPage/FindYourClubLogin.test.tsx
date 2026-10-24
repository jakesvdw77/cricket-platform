import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FindYourClubLogin from './FindYourClubLogin'

const searchClubs = vi.fn()

vi.mock('../../../api/leadApi', () => ({
  searchClubs: (...args: unknown[]) => searchClubs(...args),
}))

const RIVERSIDE = { id: '1', name: 'Riverside CC', slug: 'riverside' }
const RIVERTON = { id: '2', name: 'Riverton CC', slug: 'riverton' }

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

// jsdom's window.location isn't directly assignable, so redefine it as a writable stub to observe the real navigation.
function stubLocation() {
  const originalLocation = window.location
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: { ...originalLocation, href: originalLocation.href } })
  return {
    protocol: originalLocation.protocol,
    restore: () => Object.defineProperty(window, 'location', { configurable: true, writable: true, value: originalLocation }),
  }
}

describe('FindYourClubLogin', () => {
  beforeEach(() => {
    searchClubs.mockReset()
    window.localStorage.clear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('asks for at least 2 letters and does not search before then', async () => {
    const user = userEvent.setup()
    renderFindYourClubLogin()

    expect(screen.getByText('Type at least 2 letters of your club name')).toBeInTheDocument()
    expect(screen.getByLabelText('Search for your club')).toHaveFocus()
    await user.type(screen.getByLabelText('Search for your club'), 'r')
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(searchClubs).not.toHaveBeenCalled()
  })

  it('debounces typing into a single search and shows name and address', async () => {
    searchClubs.mockResolvedValue([RIVERSIDE])
    const user = userEvent.setup()
    renderFindYourClubLogin()

    await user.type(screen.getByLabelText('Search for your club'), 'river')

    expect(await screen.findByText('Riverside CC')).toBeInTheDocument()
    expect(screen.getByText('riverside.localhost:5173')).toBeInTheDocument()
    expect(searchClubs).toHaveBeenCalledTimes(1)
    expect(searchClubs).toHaveBeenCalledWith('river')
  })

  it('keeps the previous results on screen while a new search runs', async () => {
    let resolveSecond: (value: unknown) => void = () => {}
    searchClubs.mockResolvedValueOnce([RIVERSIDE]).mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)))
    const user = userEvent.setup()
    renderFindYourClubLogin()

    await user.type(screen.getByLabelText('Search for your club'), 'ri')
    expect(await screen.findByText('Riverside CC')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Search for your club'), 've')
    await waitFor(() => expect(searchClubs).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Riverside CC')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Searching' })).toBeInTheDocument()

    resolveSecond([RIVERSIDE, RIVERTON])
    expect(await screen.findByText('Riverton CC')).toBeInTheDocument()
  })

  it('navigates to the club subdomain login on click and remembers the club', async () => {
    searchClubs.mockResolvedValue([RIVERSIDE])
    const user = userEvent.setup()
    const location = stubLocation()
    try {
      renderFindYourClubLogin()
      await user.type(screen.getByLabelText('Search for your club'), 'river')
      await user.click(await screen.findByText('Riverside CC'))

      expect(window.location.href).toBe(`${location.protocol}//riverside.localhost:5173/login`)
      expect(JSON.parse(window.localStorage.getItem('login:lastClub') ?? '{}')).toEqual({ slug: 'riverside', name: 'Riverside CC' })
    } finally {
      location.restore()
    }
  })

  it('offers a big Continue button for the last club and uses it', async () => {
    window.localStorage.setItem('login:lastClub', JSON.stringify({ slug: 'riverside', name: 'Riverside CC' }))
    const user = userEvent.setup()
    const location = stubLocation()
    try {
      renderFindYourClubLogin()
      await user.click(screen.getByRole('button', { name: /Continue to Riverside CC/ }))
      expect(window.location.href).toBe(`${location.protocol}//riverside.localhost:5173/login`)
    } finally {
      location.restore()
    }
  })

  it('still works when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    searchClubs.mockResolvedValue([RIVERSIDE])
    const user = userEvent.setup()
    const location = stubLocation()
    try {
      renderFindYourClubLogin()
      expect(screen.queryByRole('button', { name: /Continue to/ })).not.toBeInTheDocument()
      await user.type(screen.getByLabelText('Search for your club'), 'river')
      await user.click(await screen.findByText('Riverside CC'))
      expect(window.location.href).toBe(`${location.protocol}//riverside.localhost:5173/login`)
    } finally {
      location.restore()
    }
  })

  it('moves through results with the arrow keys and opens the highlighted one with Enter', async () => {
    searchClubs.mockResolvedValue([RIVERSIDE, RIVERTON])
    const user = userEvent.setup()
    const location = stubLocation()
    try {
      renderFindYourClubLogin()
      const input = screen.getByRole('combobox')
      await user.type(input, 'river')
      await screen.findByText('Riverton CC')

      await user.keyboard('{Enter}')
      expect(window.location.href).not.toContain('riverton')

      await user.keyboard('{ArrowDown}{ArrowDown}')
      expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1].id)
      expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
      await user.keyboard('{ArrowUp}')
      expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')
      await user.keyboard('{ArrowDown}{Enter}')
      expect(window.location.href).toBe(`${location.protocol}//riverton.localhost:5173/login`)
    } finally {
      location.restore()
    }
  })

  it('goes straight to the only match on Enter', async () => {
    searchClubs.mockResolvedValue([RIVERSIDE])
    const user = userEvent.setup()
    const location = stubLocation()
    try {
      renderFindYourClubLogin()
      await user.type(screen.getByRole('combobox'), 'river')
      await screen.findByText('Riverside CC')
      await user.keyboard('{Enter}')
      expect(window.location.href).toBe(`${location.protocol}//riverside.localhost:5173/login`)
    } finally {
      location.restore()
    }
  })

  it('shows the no-match state with a link to the contact form', async () => {
    searchClubs.mockResolvedValue([])
    const user = userEvent.setup()
    renderFindYourClubLogin()

    await user.type(screen.getByLabelText('Search for your club'), 'zzz')

    expect(await screen.findByText('No clubs matched your search')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the contact form' })).toHaveAttribute('href', '#lead-capture')
  })

  it('navigates to /login from the platform admin row without searching', async () => {
    const user = userEvent.setup()
    renderFindYourClubLogin()

    await user.click(screen.getByRole('button', { name: 'Platform admin? Log in here' }))

    await waitFor(() => expect(screen.getByText('Login route')).toBeInTheDocument())
    expect(searchClubs).not.toHaveBeenCalled()
  })
})
