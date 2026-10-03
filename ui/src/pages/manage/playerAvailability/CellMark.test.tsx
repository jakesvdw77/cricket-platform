import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CellMark } from './CellMark'
import { Legend } from './Legend'

describe('CellMark', () => {
  it.each([
    ['AVAILABLE', '✓', 'Anton, Sat 3 Oct Morning, A v B: Available, group poll'],
    ['UNSURE', '?', 'Anton, Sat 3 Oct Morning, A v B: Unsure, group poll'],
    ['UNAVAILABLE', '✕', 'Anton, Sat 3 Oct Morning, A v B: Unavailable, group poll'],
  ] as const)('%s shows a glyph and its accessible name', (status, glyph, label) => {
    render(<CellMark status={status} label={label} />)

    const mark = screen.getByRole('img', { name: label })
    expect(mark).toHaveTextContent(glyph)
    expect(mark).toHaveAttribute('title', label)
    expect(mark).toHaveAttribute('data-status', status)
    expect(screen.queryByTestId('picked-dot')).not.toBeInTheDocument()
  })

  it('NO_RESPONSE is a hollow dashed circle with no glyph', () => {
    render(<CellMark status="NO_RESPONSE" label="Anton: No response" />)

    const mark = screen.getByRole('img', { name: 'Anton: No response' })
    expect(mark).toHaveTextContent('')
    expect(mark.firstElementChild).toHaveStyle({ borderStyle: 'dashed' })
  })

  it('NOT_IN_POLL is an en dash', () => {
    render(<CellMark status="NOT_IN_POLL" label="Anton: Not in this poll" />)

    expect(screen.getByRole('img', { name: 'Anton: Not in this poll' })).toHaveTextContent('–')
  })

  it('shows the picked dot, on any state, without taking the glyph away', () => {
    render(<CellMark status="AVAILABLE" picked label="Anton: Available, picked" />)

    expect(screen.getByTestId('picked-dot')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Anton: Available, picked' })).toHaveTextContent('✓')

    render(<CellMark status="NOT_IN_POLL" picked label="Bob: Not in this poll, picked" />)
    expect(screen.getAllByTestId('picked-dot')).toHaveLength(2)
  })

  it('is hidden from assistive tech when no label is given (legend use)', () => {
    const { container } = render(<CellMark status="UNSURE" />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Legend', () => {
  it('names every mark in words', () => {
    render(<Legend />)

    const legend = screen.getByRole('list', { name: 'Legend' })
    for (const text of ['Available', 'Unsure', 'Unavailable', 'No response', "Not in this game's poll (or no poll)", 'Picked for the match']) {
      expect(legend).toHaveTextContent(text)
    }
    expect(legend.querySelectorAll('li')).toHaveLength(6)
  })
})
