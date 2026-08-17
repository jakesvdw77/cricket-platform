import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { GridNavShell } from './GridNavShell'

function renderShell(onLogout = vi.fn()) {
  render(
    <MemoryRouter>
      <GridNavShell brand="Riverside CC" user={{ name: 'Sam Manager', email: 'sam@riverside.cc' }} onLogout={onLogout}>
        <div>Grid content</div>
      </GridNavShell>
    </MemoryRouter>,
  )
  return onLogout
}

describe('GridNavShell', () => {
  it('renders the brand, children, and footer', () => {
    renderShell()

    expect(screen.getByText('Riverside CC')).toBeInTheDocument()
    expect(screen.getByText('Grid content')).toBeInTheDocument()
    expect(screen.getByText(/Cricket Legend Platform/)).toBeInTheDocument()
  })

  it('logs out via the avatar menu', async () => {
    const onLogout = renderShell()

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))

    expect(onLogout).toHaveBeenCalledOnce()
  })
})
