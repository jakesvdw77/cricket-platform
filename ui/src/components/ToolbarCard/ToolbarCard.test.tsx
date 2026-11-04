import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ToolbarCard } from './ToolbarCard'
import { ToolbarSortButton } from './ToolbarSortButton'
import { ToolbarMultiToggle } from './ToolbarMultiToggle'
import { ToolbarToggle } from './ToolbarToggle'
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

describe('ToolbarToggleChip disabled (docs/specs/136)', () => {
  it('a disabled chip stays as it is and cannot be pressed', async () => {
    const onChange = vi.fn()
    render(<ToolbarToggleChip pressed disabled onChange={onChange} label="Squad Polls" />)

    const chip = screen.getByRole('button', { name: 'Squad Polls' })
    expect(chip).toBeDisabled()
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    await userEvent.setup({ pointerEventsCheck: 0 }).click(chip)
    expect(onChange).not.toHaveBeenCalled()
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

describe('ToolbarToggle', () => {
  it('is a pressed-state chip in the toolbar row', async () => {
    const onChange = vi.fn()
    render(<ToolbarToggle placement="row" checked={false} onChange={onChange} label="Show Closed" />)
    const chip = screen.getByRole('button', { name: 'Show Closed' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(chip)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('is a switch in the phone sheet', async () => {
    const onChange = vi.fn()
    render(<ToolbarToggle placement="sheet" checked={false} onChange={onChange} label="Show Closed" />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Closed' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('passes disabled to both', () => {
    const { rerender } = render(<ToolbarToggle placement="row" checked onChange={() => undefined} label="Squad" disabled />)
    expect(screen.getByRole('button', { name: 'Squad' })).toBeDisabled()
    rerender(<ToolbarToggle placement="sheet" checked onChange={() => undefined} label="Squad" disabled />)
    expect(screen.getByRole('checkbox', { name: 'Squad' })).toBeDisabled()
  })
})

describe('ToolbarMultiToggle', () => {
  const options = [
    { value: 'a', label: 'Alpha', icon: <span /> },
    { value: 'b', label: 'Beta', icon: <span /> },
  ]

  it('toggles each part on its own and reports the selected set', async () => {
    const onChange = vi.fn()
    render(<ToolbarMultiToggle ariaLabel="Kinds" options={options} selected={['a', 'b']} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Beta' }))
    expect(onChange).toHaveBeenCalledWith(['a'])
  })

  it('disables the last part left on', () => {
    render(<ToolbarMultiToggle ariaLabel="Kinds" options={options} selected={['a']} onChange={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Alpha' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Beta' })).toBeEnabled()
  })
})
