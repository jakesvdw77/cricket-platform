import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ManageScreenHeader } from './ManageScreenHeader'
import { baseTheme } from '../../theme'

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

  // docs/specs/046-header-body-elevation-standard.md
  it('renders the header inside a PageHeaderBand', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <MemoryRouter>
          <ManageScreenHeader title="Club Contacts" backTo="/manage" backLabel="Back to Dashboard" />
        </MemoryRouter>
      </ThemeProvider>,
    )

    // PageHeaderBand renders a single Box wrapping ManageScreenHeader's own back-link+title-row
    // Box directly — the Back link's own DOM grandparent is that PageHeaderBand Box, carrying its
    // distinguishing treatment (flat white background, 3px solid primary.main top accent).
    const backLink = screen.getByRole('link', { name: /back to dashboard/i })
    const band = backLink.parentElement?.parentElement as HTMLElement

    expect(band).toContainElement(screen.getByRole('heading', { name: 'Club Contacts' }))
    expect(band).toHaveStyle({
      backgroundColor: 'rgb(255, 255, 255)',
      borderTopWidth: '3px',
      borderTopStyle: 'solid',
      borderTopColor: 'rgb(47, 110, 79)', // baseTheme.palette.primary.main
    })
  })

  // docs/specs/046-header-body-elevation-standard.md: fontWeight 700 replaces the component's old
  // fontWeight={600} — a real replacement, not an addition on top of it.
  it('renders the title at fontWeight 700, not 600', () => {
    render(
      <MemoryRouter>
        <ManageScreenHeader title="Club Contacts" />
      </MemoryRouter>,
    )

    const heading = screen.getByRole('heading', { name: 'Club Contacts' })
    expect(heading).toHaveStyle({ fontWeight: '700' })
    expect(heading).not.toHaveStyle({ fontWeight: '600' })
  })
})
