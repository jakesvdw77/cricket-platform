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
})
