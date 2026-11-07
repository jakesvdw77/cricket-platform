import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToggleButton } from '@mui/material'
import { describe, expect, it, vi } from 'vitest'
import { CompactToggleGroup } from './CompactToggleGroup'

function renderGroup(onChange = vi.fn()) {
  render(
    <CompactToggleGroup value="a" onChange={onChange} ariaLabel="Mode">
      <ToggleButton value="a">One</ToggleButton>
      <ToggleButton value="b">Two</ToggleButton>
    </CompactToggleGroup>,
  )
  return onChange
}

describe('CompactToggleGroup', () => {
  it('marks the selected option and is a labelled group', () => {
    renderGroup()
    expect(screen.getByRole('group', { name: 'Mode' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Two' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports another option, and ignores a click on the selected one', async () => {
    const onChange = renderGroup()
    await userEvent.click(screen.getByRole('button', { name: 'One' }))
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Two' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })
})

// docs/specs/147: the Hub console look. The tone changes the look only; the behaviour is the same.
describe('CompactToggleGroup tone dark', () => {
  const dark = (onChange = vi.fn()) => {
    render(
      <CompactToggleGroup value="a" onChange={onChange} ariaLabel="Mode" tone="dark">
        <ToggleButton value="a">One</ToggleButton>
        <ToggleButton value="b">Two</ToggleButton>
      </CompactToggleGroup>,
    )
    return onChange
  }

  it('keeps the labelled group and the pressed state, and draws 28 px uppercase labels with a gold selected one', () => {
    dark()
    expect(screen.getByRole('group', { name: 'Mode' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-pressed', 'true')
    const two = screen.getByRole('button', { name: 'Two' })
    expect(two).toHaveStyle({ height: '28px', 'text-transform': 'uppercase', 'font-size': '12px' })
    expect(screen.getByRole('button', { name: 'One' })).toHaveStyle({ color: 'rgb(232, 184, 61)' })
  })

  it('still reports another option on a click', async () => {
    const onChange = dark()
    await userEvent.click(screen.getByRole('button', { name: 'Two' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })
})
