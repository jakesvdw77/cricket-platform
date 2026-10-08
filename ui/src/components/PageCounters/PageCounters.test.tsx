import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { describe, expect, it, vi } from 'vitest'
import { PageCounters } from './PageCounters'
import type { PageCounterItem } from './PageCounters'
import { baseTheme } from '../../theme'
import { hoverTintColor } from './keyFigureStyle'

function renderCounters(items: PageCounterItem[], loading = false, density?: 'comfortable' | 'compact') {
  return render(
    <ThemeProvider theme={baseTheme}>
      <PageCounters items={items} loading={loading} density={density} />
    </ThemeProvider>,
  )
}

const items: PageCounterItem[] = [
  { id: 'a', value: 3, label: 'Open polls' },
  { id: 'b', value: '5 / 9', label: 'Players responded' },
  { id: 'c', value: 4, label: 'Players still to answer', tone: 'warning' },
]

describe('PageCounters', () => {
  it('shows each value and label', () => {
    renderCounters(items)

    expect(screen.getByText('Open polls')).toBeInTheDocument()
    expect(screen.getByText('5 / 9')).toBeInTheDocument()
    expect(screen.getAllByTestId('page-counter-value').map((node) => node.textContent)).toEqual(['3', '5 / 9', '4'])
  })

  it('colours only a warning value with the warning colour', () => {
    renderCounters(items)

    const [plain, , warn] = screen.getAllByTestId('page-counter-value')
    expect(getComputedStyle(warn).color).not.toBe(getComputedStyle(plain).color)
    expect(getComputedStyle(warn).color).toBe('rgb(183, 121, 31)')
  })

  it('outlines the active counter only', () => {
    renderCounters([{ ...items[0], active: true }, items[1]])

    expect(screen.getByTestId('page-counter-a')).toHaveAttribute('data-active', 'true')
    expect(getComputedStyle(screen.getByTestId('page-counter-a')).outline).toMatch(/2px solid rgba\(47, 110, 79, 0\.55\)/)
    expect(screen.getByTestId('page-counter-b')).not.toHaveAttribute('data-active')
  })

  it('renders plain cards, not buttons, without onSelect', () => {
    renderCounters(items)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a selectable counter as a button with a hint and aria-pressed, selectable by click', async () => {
    const onSelect = vi.fn()
    renderCounters([{ ...items[0], onSelect, hint: 'Tap to filter', active: true }, { ...items[1], onSelect: vi.fn() }])

    const button = screen.getByRole('button', { name: /Open polls/ })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Players responded/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Tap to filter')).toBeInTheDocument()
    await userEvent.click(button)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('selects with Enter and Space from the keyboard', async () => {
    const onSelect = vi.fn()
    renderCounters([{ ...items[0], onSelect }])

    await userEvent.tab()
    expect(screen.getByRole('button')).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it('shows four skeleton cards and no values while loading', () => {
    const { container } = renderCounters(items, true)

    expect(screen.getByTestId('page-counters-loading')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThanOrEqual(8)
    expect(screen.queryByText('Open polls')).not.toBeInTheDocument()
  })

  it('lays out two columns by default and four from the md breakpoint', () => {
    const { container } = renderCounters(items)
    const grid = container.firstElementChild as HTMLElement
    const css = Array.from(document.querySelectorAll('style'))
      .flatMap((style) => Array.from(style.sheet?.cssRules ?? []))
      .map((rule) => rule.cssText)
      .filter((text) => Array.from(grid.classList).some((name) => text.includes(`.${name}`)))
      .join('\n')

    expect(css).toMatch(/grid-template-columns:\s*repeat\(2,\s*1fr\)/)
    expect(css).toMatch(/@media \(min-width:\s*900px\)[^]*repeat\(4,\s*1fr\)/)
  })

  describe('compact density (085)', () => {
    it('renders one-line cards: row direction and a minimum height of 44 px', () => {
      renderCounters(items, false, 'compact')

      const card = screen.getByTestId('page-counter-a')
      expect(getComputedStyle(card).flexDirection).toBe('row')
      expect(getComputedStyle(card).minHeight).toBe('44px')
    })

    it('keeps the comfortable look by default', () => {
      renderCounters(items)

      expect(getComputedStyle(screen.getByTestId('page-counter-a')).flexDirection).toBe('column')
      expect(getComputedStyle(screen.getByTestId('page-counter-a')).minHeight).not.toBe('44px')
    })

    it('uses a 6 px gap and truncates the label with an ellipsis', () => {
      const { container } = renderCounters(items, false, 'compact')

      expect(getComputedStyle(container.firstElementChild as HTMLElement).gap).toBe('6px')
      expect(getComputedStyle(screen.getByText('Open polls')).textOverflow).toBe('ellipsis')
    })

    it('keeps markers, aria-pressed, the zero rule and the hidden hint', () => {
      renderCounters(
        [
          { ...items[0], kind: 'filter', onSelect: vi.fn(), hint: 'Tap to filter', active: true },
          { ...items[1], kind: 'drill', onSelect: vi.fn(), hint: 'See who' },
          { id: 'z', value: 0, label: 'Zero', onSelect: vi.fn() },
        ],
        false,
        'compact',
      )

      expect(screen.getByRole('button', { name: /Open polls/ })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByTestId('page-counter-a-marker')).toHaveTextContent('filter')
      expect(screen.getByTestId('page-counter-b-marker')).toHaveTextContent('›')
      expect(getComputedStyle(screen.getByTestId('page-counter-a-marker')).top).toBe('50%')
      expect(screen.getByText('See who')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Zero/ })).not.toBeInTheDocument()
    })

    it('shows four compact skeleton cards while loading', () => {
      const { container } = renderCounters(items, true, 'compact')

      expect(screen.getByTestId('page-counters-loading')).toHaveAttribute('aria-busy', 'true')
      expect(container.querySelectorAll('.MuiCard-root')).toHaveLength(4)
      expect(getComputedStyle(container.querySelector('.MuiCard-root') as HTMLElement).minHeight).toBe('44px')
    })
  })

  describe('counter kinds and the zero rule (084)', () => {
    it('defaults to a filter counter: a toggle button with a "filter" tag and aria-pressed', () => {
      renderCounters([{ ...items[0], onSelect: vi.fn() }])

      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByTestId('page-counter-a-marker')).toHaveTextContent('filter')
      expect(screen.getByTestId('page-counter-a-marker')).toHaveAttribute('aria-hidden', 'true')
    })

    it('a drill-down counter is a plain button with a chevron and no aria-pressed, even when active', async () => {
      const onSelect = vi.fn()
      renderCounters([{ ...items[0], kind: 'drill', onSelect, hint: 'See who', active: true }])

      const button = screen.getByRole('button', { name: /Open polls/ })
      expect(button).not.toHaveAttribute('aria-pressed')
      expect(screen.getByTestId('page-counter-a-marker')).toHaveTextContent('›')
      expect(screen.getByText('See who')).toBeInTheDocument()
      await userEvent.click(button)
      expect(onSelect).toHaveBeenCalledTimes(1)
    })

    it('a plain card has no marker and no hint, whatever its kind', () => {
      renderCounters([{ ...items[0], kind: 'drill', hint: 'See who' }])

      expect(screen.queryByTestId('page-counter-a-marker')).not.toBeInTheDocument()
      expect(screen.queryByText('See who')).not.toBeInTheDocument()
    })

    it('at zero a selectable counter is a plain card with no marker', () => {
      const onSelect = vi.fn()
      renderCounters([
        { id: 'z', value: 0, label: 'Close in 48 hours', onSelect, hint: 'Tap to filter' },
        { id: 'zs', value: '0', label: 'Zero as text', onSelect, kind: 'drill' },
      ])

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.queryByTestId('page-counter-z-marker')).not.toBeInTheDocument()
      expect(screen.queryByTestId('page-counter-zs-marker')).not.toBeInTheDocument()
    })

    it('treats "0 / 24" as zero, but not "10 / 24", "0.5" or 5', () => {
      const onSelect = vi.fn()
      renderCounters([
        { id: 'a', value: '0 / 24', label: 'A', onSelect, kind: 'drill' },
        { id: 'b', value: '10 / 24', label: 'B', onSelect, kind: 'drill' },
        { id: 'c', value: '0.5', label: 'C', onSelect, kind: 'drill' },
        { id: 'd', value: 5, label: 'D', onSelect },
      ])

      expect(screen.queryByRole('button', { name: /^0 \/ 24/ })).not.toBeInTheDocument()
      expect(screen.getAllByRole('button').map((b) => b.getAttribute('data-testid'))).toEqual([
        'page-counter-b',
        'page-counter-c',
        'page-counter-d',
      ])
    })

    it('at zero the active filter counter stays a pressed button so it can be switched off', async () => {
      const onSelect = vi.fn()
      renderCounters([{ id: 'z', value: 0, label: 'Close in 48 hours', onSelect, active: true }])

      const button = screen.getByRole('button', { name: /Close in 48 hours/ })
      expect(button).toHaveAttribute('aria-pressed', 'true')
      await userEvent.click(button)
      expect(onSelect).toHaveBeenCalledTimes(1)
    })

    it('lifts and tints a selectable counter on hover, but not a plain card', () => {
      renderCounters([{ ...items[0], onSelect: vi.fn() }, items[1]])
      const css = Array.from(document.querySelectorAll('style'))
        .flatMap((style) => Array.from(style.sheet?.cssRules ?? []))
        .map((rule) => rule.cssText)
        .join('\n')
      const classOf = (id: string) => Array.from(screen.getByTestId(`page-counter-${id}`).classList).find((name) => name.startsWith('css-')) as string

      expect(css).toMatch(new RegExp(`${classOf('a')}:hover`))
      expect(css).not.toMatch(new RegExp(`${classOf('b')}:hover`))
    })

    // The corner marker and the hint are small primary-coloured text on the white key-figure card.
    it('keeps the marker colour above 4.5:1 against the card background', () => {
      const luminance = (hex: string) => {
        const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const rgbToHex = (rgb: string) =>
        '#' + (rgb.match(/\d+/g) ?? []).map((n) => Number(n).toString(16).padStart(2, '0')).join('')
      const ratio = (a: string, b: string) => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
        return (hi + 0.05) / (lo + 0.05)
      }
      expect(ratio(baseTheme.palette.primary.main, baseTheme.palette.background.paper)).toBeGreaterThanOrEqual(4.5)
      // Hovered: the card colour blended with the hover tint, computed from the theme.
      expect(ratio(baseTheme.palette.primary.main, rgbToHex(hoverTintColor(baseTheme)))).toBeGreaterThanOrEqual(4.5)
    })
  })
})
