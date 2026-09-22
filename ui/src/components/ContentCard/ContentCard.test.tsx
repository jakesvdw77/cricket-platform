import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { ContentCard } from './ContentCard'
import { RecordCard } from '../RecordCard'
import { baseTheme } from '../../theme'

// docs/specs/046-header-body-elevation-standard.md: the shared body-content surface for
// RecordDetailScreen's sections and RecordFormScreen's field grid/actions bar — reusing
// RecordCard.tsx's own existing bgcolor: 'background.paper' / boxShadow: 2 card convention
// directly, not a new shadow recipe.

describe('ContentCard', () => {
  it('renders its children', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <ContentCard>
          <div>Card content</div>
        </ContentCard>
      </ThemeProvider>,
    )

    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('renders the exact same bgcolor/boxShadow surface RecordCard.tsx uses for its own MuiCard', () => {
    const { container: contentCardContainer } = render(
      <ThemeProvider theme={baseTheme}>
        <ContentCard>
          <div>Content</div>
        </ContentCard>
      </ThemeProvider>,
    )
    const { container: recordCardContainer } = render(
      <ThemeProvider theme={baseTheme}>
        <RecordCard title="Reference" />
      </ThemeProvider>,
    )

    const contentCard = contentCardContainer.firstChild as HTMLElement
    const recordCard = recordCardContainer.querySelector('.MuiCard-root') as HTMLElement
    expect(recordCard).not.toBeNull()

    // bgcolor: 'background.paper' — identical literal value on both.
    expect(contentCard).toHaveStyle({ backgroundColor: 'rgb(255, 255, 255)' })
    expect(recordCard).toHaveStyle({ backgroundColor: 'rgb(255, 255, 255)' })

    // boxShadow: 2 — a direct comparison of the two components' own computed shadow strings,
    // rather than a hardcoded shadow value, so this only passes if they're genuinely identical.
    expect(getComputedStyle(contentCard).boxShadow).toBe(getComputedStyle(recordCard).boxShadow)
    expect(getComputedStyle(contentCard).boxShadow).not.toBe('')
  })

  it('applies the documented borderRadius: 1 / p: 3 defaults', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <ContentCard>
          <div>Content</div>
        </ContentCard>
      </ThemeProvider>,
    )

    const card = screen.getByText('Content').parentElement as HTMLElement
    // borderRadius: 1 => theme.shape.borderRadius (8) x 1 = 8px; p: 3 => theme.spacing(3) = 24px.
    expect(card).toHaveStyle({
      borderRadius: '8px',
      paddingTop: '24px',
      paddingRight: '24px',
      paddingBottom: '24px',
      paddingLeft: '24px',
    })
  })

  it('merges a passed sx onto the defaults rather than replacing them', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <ContentCard sx={{ pb: 4 }}>
          <div>Content</div>
        </ContentCard>
      </ThemeProvider>,
    )

    const card = screen.getByText('Content').parentElement as HTMLElement
    // ContentCard's own sx is `{ bgcolor: ..., boxShadow: 2, borderRadius: 1, p: 3, ...sx }` — a
    // single flat object, not an sx array, so a passed `sx={{ pb: 4 }}` spreads in after `p: 3` and
    // overrides only the bottom padding it names (32px), leaving bgcolor/boxShadow/borderRadius and
    // the other three padding sides exactly as the defaults set them (24px) — confirming a merge,
    // not a wholesale replacement of the defaults.
    expect(card).toHaveStyle({
      backgroundColor: 'rgb(255, 255, 255)',
      borderRadius: '8px',
      paddingTop: '24px',
      paddingRight: '24px',
      paddingLeft: '24px',
      paddingBottom: '32px',
    })
  })
})
