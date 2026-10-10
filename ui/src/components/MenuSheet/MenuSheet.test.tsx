import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { MenuSheet } from './MenuSheet'
import { MANAGER_NAV } from '../ManagerShell/managerNav'

function Harness({ onClose = vi.fn(), initialOpen = true }: { onClose?: () => void; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <MemoryRouter initialEntries={['/manage/fixtures/matches']}>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <MenuSheet
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => {
          onClose()
          setOpen(false)
        }}
        groups={MANAGER_NAV}
        badges={{ availability: 2 }}
      />
    </MemoryRouter>
  )
}

describe('MenuSheet', () => {
  it('is not reachable while closed and the grouped tiles when open', () => {
    const { unmount } = render(<Harness initialOpen={false} />)
    // The drawer stays mounted but hidden, so it is not reachable by role.
    expect(screen.queryByRole('link', { name: 'Leagues' })).not.toBeInTheDocument()
    unmount()

    render(<Harness />)
    for (const heading of ['Schedule', 'People', 'Club']) {
      expect(screen.getAllByText(heading).length).toBeGreaterThan(0)
    }
    expect(screen.getByRole('link', { name: 'Leagues' })).toHaveAttribute('href', '/manage/fixtures/leagues')
    expect(screen.getByRole('link', { name: 'Seasons' })).toHaveAttribute('href', '/manage/fixtures/seasons')
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByTestId('badge-availability')).toHaveTextContent('2')
  })

  it('renders tile icons at 40 px', () => {
    render(<Harness />)

    const img = screen.getByRole('link', { name: 'Teams' }).querySelector('img') as HTMLImageElement
    expect(img).toHaveStyle({ width: '40px', height: '40px' })
  })

  it('marks the tile for the current route', () => {
    render(<Harness />)

    expect(screen.getByRole('link', { name: /^Matches$/ })).toHaveAttribute('aria-current', 'page')
  })

  it('closes with the close button', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(onClose).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Leagues' })).not.toBeInTheDocument())
  })

  it('closes with Escape', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await userEvent.click(document.querySelector('.MuiBackdrop-root') as HTMLElement)
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when a destination is chosen', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await userEvent.click(screen.getByRole('link', { name: 'Players' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
