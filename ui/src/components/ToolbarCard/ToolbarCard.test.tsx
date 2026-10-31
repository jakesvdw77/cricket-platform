import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ToolbarCard } from './ToolbarCard'
import { ToolbarSortButton } from './ToolbarSortButton'
import { ToolbarToggleChip } from './ToolbarToggleChip'
import { toolbarControlSx, toolbarSegmentedSx } from './toolbarControlSx'
import { ListViewToggle } from '../ListViewToggle'

describe('ToolbarCard', () => {
  it('standalone is a flat white card with a hairline border and no shadow', () => {
    render(<ToolbarCard><span>Bar</span></ToolbarCard>)
    const card = screen.getByTestId('toolbar-card')
    expect(card).toHaveAttribute('data-composition', 'standalone')
    expect(card).toHaveTextContent('Bar')
    const style = getComputedStyle(card)
    expect(style.borderStyle).toBe('solid')
    expect(style.boxShadow === '' || style.boxShadow === 'none' || !style.boxShadow.includes('rgba')).toBe(true)
  })

  it('fused has only a hairline below it, the table owns the outer border', () => {
    render(<ToolbarCard fused><span>Bar</span></ToolbarCard>)
    const card = screen.getByTestId('toolbar-card-fused')
    expect(card).toHaveAttribute('data-composition', 'fused')
    const style = getComputedStyle(card)
    expect(style.borderBottomStyle).toBe('solid')
    expect(style.borderTopStyle).not.toBe('solid')
  })
})

describe('ToolbarSortButton', () => {
  const options = [
    { value: 'asc', label: 'Name, A to Z' },
    { value: 'desc', label: 'Name, Z to A' },
  ]

  it('reads "Sort: <current>" and opens the orders as a menu, the current one ticked', async () => {
    const onChange = vi.fn()
    render(<ToolbarSortButton value="asc" options={options} onChange={onChange} />)
    const button = screen.getByRole('button', { name: 'Sort: Name, A to Z' })
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'Name, A to Z' })).toHaveClass('Mui-selected')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Name, Z to A' }))
    expect(onChange).toHaveBeenCalledWith('desc')
  })

  it('is operable from the keyboard and is 36 px high', async () => {
    const onChange = vi.fn()
    render(<ToolbarSortButton value="asc" options={options} onChange={onChange} />)
    const button = screen.getByRole('button', { name: /Sort:/ })
    expect(getComputedStyle(button).height).toBe('36px')
    await userEvent.tab()
    expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalled()
  })
})

describe('ToolbarToggleChip', () => {
  it('is a 36 px toggle button with aria-pressed that flips on click and on Space', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<ToolbarToggleChip pressed={false} onChange={onChange} label="Show inactive" />)
    const chip = screen.getByRole('button', { name: 'Show inactive' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect(getComputedStyle(chip).height).toBe('36px')
    await userEvent.click(chip)
    expect(onChange).toHaveBeenLastCalledWith(true)
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenCalledTimes(2)
    rerender(<ToolbarToggleChip pressed onChange={onChange} label="Show inactive" />)
    expect(screen.getByRole('button', { name: 'Show inactive' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Show inactive' }))
    expect(onChange).toHaveBeenLastCalledWith(false)
  })
})

describe('toolbar controls share one style helper', () => {
  it('the sort button, the toggle chip and the segmented control have the same edge colour, radius, height, font and ink', () => {
    render(
      <>
        <ToolbarSortButton value="a" options={[{ value: 'a', label: 'Name, A to Z' }]} onChange={vi.fn()} />
        <ToolbarToggleChip pressed={false} onChange={vi.fn()} label="Show inactive" />
        <ListViewToggle value="cards" onChange={vi.fn()} variant="toolbar" />
      </>,
    )
    const sort = getComputedStyle(screen.getByRole('button', { name: /Sort:/ }))
    const chip = getComputedStyle(screen.getByRole('button', { name: 'Show inactive' }))
    const group = getComputedStyle(screen.getByRole('group', { name: 'View' }))
    for (const style of [sort, chip, group]) {
      expect(style.height).toBe('36px')
      expect(style.borderTopWidth).toBe('1px')
      expect(style.borderTopColor).toBe(sort.borderTopColor)
      expect(style.borderRadius).toBe('6px')
    }
    // (segment text colour, weight and border are defined by the helper below; jsdom ignores selector specificity so MUI's own rules
    // would win in a computed-style check here but not in a browser)
    // The helper defines the edge once: the segmented control's outer edge and its single divider use the same token as the others.
    expect(toolbarSegmentedSx.borderColor).toBe(toolbarControlSx.borderColor)
    expect(toolbarSegmentedSx.borderRadius).toBe(toolbarControlSx.borderRadius)
    expect(toolbarSegmentedSx.height).toBe(toolbarControlSx.height)
    expect(toolbarSegmentedSx['& .MuiToggleButtonGroup-grouped:not(:first-of-type)'].borderLeftColor).toBe(toolbarControlSx.borderColor)
    expect(toolbarSegmentedSx['& .MuiToggleButtonGroup-grouped'].border).toBe(0)
    expect(toolbarSegmentedSx['& .MuiToggleButtonGroup-grouped'].color).toBe(toolbarControlSx.color)
    expect(toolbarSegmentedSx['& .MuiToggleButtonGroup-grouped'].fontSize).toBe(toolbarControlSx.fontSize)
    expect(toolbarSegmentedSx['& .MuiToggleButtonGroup-grouped'].fontWeight).toBe(toolbarControlSx.fontWeight)
  })
})
