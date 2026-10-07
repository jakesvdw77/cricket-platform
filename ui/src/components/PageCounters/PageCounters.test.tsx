import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { describe, expect, it, vi } from 'vitest'
import { PageCounters } from './PageCounters'
import type { PageCounterItem } from './PageCounters'
import { baseTheme } from '../../theme'

function renderCounters(items: PageCounterItem[], loading = false) {
  return render(
    <ThemeProvider theme={baseTheme}>
      <PageCounters items={items} loading={loading} />
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
})
