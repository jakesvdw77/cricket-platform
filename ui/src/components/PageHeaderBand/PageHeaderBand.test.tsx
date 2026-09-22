import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { PageHeaderBand } from './PageHeaderBand'
import { baseTheme, headerBandShadow, withClubBranding } from '../../theme'

// docs/specs/046-header-body-elevation-standard.md: the shared header treatment — flat white
// background, a divider-derived bottom border, a headerBandShadow(theme)-derived box-shadow, and a
// primary.main top accent bar. Every value but the accent bar is theme-independent (it never varies
// per club), so these tests render once under baseTheme and once under a club-branded theme to
// prove that split explicitly, mirroring the "theme-derived where it should be, not where it
// shouldn't be" shape RecordDetailScreen.test.tsx's own prior (now-superseded) 044 tests used.

const clubTheme = withClubBranding('#2563ac')

describe('PageHeaderBand', () => {
  it('renders its children', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <PageHeaderBand>
          <div>Header content</div>
        </PageHeaderBand>
      </ThemeProvider>,
    )

    expect(screen.getByText('Header content')).toBeInTheDocument()
  })

  it('renders a flat white background and a divider-derived bottom border, identically under a club-branded theme', () => {
    const { container, rerender } = render(
      <ThemeProvider theme={baseTheme}>
        <PageHeaderBand>
          <div>Content</div>
        </PageHeaderBand>
      </ThemeProvider>,
    )

    const band = container.firstChild as HTMLElement
    expect(band).toHaveStyle({
      backgroundColor: 'rgb(255, 255, 255)', // baseTheme.palette.background.paper (#ffffff)
      borderBottomWidth: '1px',
      borderBottomStyle: 'solid',
      borderBottomColor: 'rgb(222, 230, 225)', // baseTheme.palette.divider (#dee6e1)
    })

    rerender(
      <ThemeProvider theme={clubTheme}>
        <PageHeaderBand>
          <div>Content</div>
        </PageHeaderBand>
      </ThemeProvider>,
    )

    const bandUnderClubBranding = container.firstChild as HTMLElement
    expect(bandUnderClubBranding).toHaveStyle({
      backgroundColor: 'rgb(255, 255, 255)',
      borderBottomWidth: '1px',
      borderBottomStyle: 'solid',
      borderBottomColor: 'rgb(222, 230, 225)',
    })
  })

  it('derives its box-shadow from headerBandShadow(theme), identically regardless of club branding', () => {
    // PageHeaderBand's own sx sets `boxShadow: (theme) => headerBandShadow(theme)` verbatim, so
    // this is exactly what the component's sx callback resolves to for a given theme — asserted
    // against the exported pure helper directly rather than scraped off the DOM, since jsdom/
    // emotion-generated classes are unreliable for reading a computed box-shadow string (the same
    // approach 044's own, now-superseded header tests used).
    expect(headerBandShadow(baseTheme)).toBe('0 2px 6px rgba(20, 35, 28, 0.06)') // alpha(text.primary #14231c, 0.06)
    expect(headerBandShadow(clubTheme)).toBe(headerBandShadow(baseTheme))
  })

  it('renders a 3px primary.main top accent bar whose colour differs between the base theme and a club-branded theme', () => {
    const { container, rerender } = render(
      <ThemeProvider theme={baseTheme}>
        <PageHeaderBand>
          <div>Content</div>
        </PageHeaderBand>
      </ThemeProvider>,
    )

    const band = container.firstChild as HTMLElement
    expect(band).toHaveStyle({
      borderTopWidth: '3px',
      borderTopStyle: 'solid',
      borderTopColor: 'rgb(47, 110, 79)', // baseTheme.palette.primary.main (#2f6e4f)
    })

    rerender(
      <ThemeProvider theme={clubTheme}>
        <PageHeaderBand>
          <div>Content</div>
        </PageHeaderBand>
      </ThemeProvider>,
    )

    const bandUnderClubBranding = container.firstChild as HTMLElement
    expect(bandUnderClubBranding).toHaveStyle({
      borderTopWidth: '3px',
      borderTopStyle: 'solid',
      borderTopColor: 'rgb(37, 99, 172)', // withClubBranding('#2563ac')'s primary.main
    })
  })
})
