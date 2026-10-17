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

  describe('a disabled option (docs/specs/104: a published match cannot be chosen)', () => {
    const withDisabled = [
      { value: 'a', content: 'Alpha' },
      { value: 'b', content: 'Beta', disabled: true },
      { value: 'c', content: 'Gamma' },
    ]

    it('cannot be clicked, and the rest of the group still works', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      const onChange = vi.fn()
      render(<TileChoiceGroup label="Pick" options={withDisabled} value={null} onChange={onChange} columns="1fr" />)

      expect(screen.getByRole('radio', { name: 'Beta' })).toBeDisabled()
      await user.click(screen.getByRole('radio', { name: 'Beta' }))
      expect(onChange).not.toHaveBeenCalled()
      await user.click(screen.getByRole('radio', { name: 'Gamma' }))
      expect(onChange).toHaveBeenCalledWith('c')
    })

    it('is skipped by the arrow keys, and the tab stop is the first tile that can be chosen', async () => {
      const onChange = vi.fn()
      render(<TileChoiceGroup label="Pick" options={withDisabled} value="a" onChange={onChange} columns="1fr" />)
      screen.getByRole('radio', { name: 'Alpha' }).focus()
      await userEvent.keyboard('{ArrowRight}')
      expect(onChange).toHaveBeenLastCalledWith('c')
      await userEvent.keyboard('{ArrowLeft}')
      expect(onChange).toHaveBeenLastCalledWith('a')
    })

    it('does not put the tab stop on a disabled first tile', () => {
      render(<TileChoiceGroup<string> label="Pick" options={[{ value: 'a', content: 'Alpha', disabled: true }, { value: 'b', content: 'Beta' }]} value={null} onChange={vi.fn()} columns="1fr" />)
      expect(screen.getAllByRole('radio').map((tile) => tile.tabIndex)).toEqual([-1, 0])
    })
  })

  // docs/specs/109-delete-empty-match.md: an adornment sits beside the tile, not inside it.
  it('draws an adornment outside the radio: not in its name, and pressing it never chooses the tile', async () => {
    const onChange = vi.fn()
    const onAdorn = vi.fn()
    const withAdornment = [{ value: 'a', content: 'Alpha', adornment: <button onClick={onAdorn}>Remove Alpha</button> }, { value: 'b', content: 'Beta' }]
    render(<TileChoiceGroup label="Pick" options={withAdornment} value={null} onChange={onChange} columns="1fr" />)

    expect(screen.getByRole('radio', { name: 'Alpha' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove Alpha' }))
    expect(onAdorn).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })
})
