import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { PageHeaderBand } from './PageHeaderBand'
import { baseTheme, withClubBranding } from '../../theme'

// docs/specs/081-plain-page-header-and-counters.md (amends 046): PageHeaderBand is a plain
// container — no accent line, shadow, radius, bleed margins, background or border — identical
// under any club theme.

const clubTheme = withClubBranding('#2563ac')

function renderUnder(theme: typeof baseTheme) {
  return render(
    <ThemeProvider theme={theme}>
      <PageHeaderBand>
        <div>Header content</div>
      </PageHeaderBand>
    </ThemeProvider>,
  )
}

describe('PageHeaderBand', () => {
  it('renders its children', () => {
    renderUnder(baseTheme)
    expect(screen.getByText('Header content')).toBeInTheDocument()
  })

  it.each([
    ['base theme', baseTheme],
    ['club-branded theme', clubTheme],
  ])('has no accent border, shadow, radius, background or negative margins under the %s', (_name, theme) => {
    const { container } = renderUnder(theme)
    const el = container.firstChild as HTMLElement
    const style = getComputedStyle(el)

    expect(style.borderTopWidth).not.toBe('3px')
    expect(['', '0px']).toContain(style.borderTopWidth)
    expect(['', '0px']).toContain(style.borderBottomWidth)
    expect(['', 'none']).toContain(style.boxShadow)
    expect(['', '0px']).toContain(style.borderBottomLeftRadius)
    expect(['', '0px']).toContain(style.borderBottomRightRadius)
    expect(['', 'rgba(0, 0, 0, 0)', 'transparent']).toContain(style.backgroundColor)
    expect(style.marginLeft.startsWith('-')).toBe(false)
    expect(style.marginTop.startsWith('-')).toBe(false)
  })
})
