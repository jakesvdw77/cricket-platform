import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ManageScreenHeader } from './ManageScreenHeader'

describe('ManageScreenHeader', () => {
  it('renders the title as a heading and a Back action to the given target', () => {
    render(
      <MemoryRouter>
        <ManageScreenHeader title="Club Contacts" backTo="/manage" backLabel="Back to Dashboard" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Club Contacts' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/manage')
  })

  it('defaults backTo and backLabel when omitted', () => {
    render(
      <MemoryRouter>
        <ManageScreenHeader title="Club Sponsors" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/manage')
  })

  // docs/specs/041-list-screen-header-actions.md: an additive, optional slot for a screen's
  // primary create action, rendered top-right beside the title — absent when the caller doesn't
  // pass one, so every existing title-only call site is unaffected.
  it('renders a passed action, and renders nothing extra when action is omitted', () => {
    const { rerender } = render(
      <MemoryRouter>
        <ManageScreenHeader title="Matches" action={<button type="button">Add Match</button>} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'Add Match' })).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <ManageScreenHeader title="Matches" />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: 'Add Match' })).not.toBeInTheDocument()
  })
})
