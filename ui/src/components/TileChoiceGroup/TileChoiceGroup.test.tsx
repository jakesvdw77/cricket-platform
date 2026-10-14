import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TileChoiceGroup } from './TileChoiceGroup'

const options = [
  { value: 'a', content: 'Alpha' },
  { value: 'b', content: 'Beta' },
  { value: 'c', content: 'Gamma' },
]

describe('TileChoiceGroup', () => {
  it('is a named radiogroup that marks the chosen tile and reports a click', async () => {
    const onChange = vi.fn()
    render(<TileChoiceGroup label="Pick one" options={options} value="b" onChange={onChange} columns="1fr" />)

    expect(screen.getByRole('radiogroup', { name: 'Pick one' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: 'Gamma' }))
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('keeps one tab stop: the chosen tile, or the first when nothing is chosen', () => {
    const { rerender } = render(<TileChoiceGroup label="Pick" options={options} value="b" onChange={vi.fn()} columns="1fr" />)
    expect(screen.getAllByRole('radio').map((tile) => tile.tabIndex)).toEqual([-1, 0, -1])

    rerender(<TileChoiceGroup label="Pick" options={options} value={null} onChange={vi.fn()} columns="1fr" />)
    expect(screen.getAllByRole('radio').map((tile) => tile.tabIndex)).toEqual([0, -1, -1])
  })

  it('moves focus and choice with the arrow keys, wrapping at the ends', async () => {
    const onChange = vi.fn()
    render(<TileChoiceGroup label="Pick" options={options} value="c" onChange={onChange} columns="1fr" />)

    screen.getByRole('radio', { name: 'Gamma' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('a')
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveFocus()

    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('c')
    await userEvent.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith('a')
    await userEvent.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith('c')
  })

  it('disables every tile', () => {
    render(<TileChoiceGroup label="Pick" options={options} value={null} onChange={vi.fn()} disabled columns="1fr" />)

    for (const tile of screen.getAllByRole('radio')) expect(tile).toBeDisabled()
  })
})
