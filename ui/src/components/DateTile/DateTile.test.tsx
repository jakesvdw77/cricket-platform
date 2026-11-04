import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DateTile } from './DateTile'

describe('DateTile', () => {
  it('shows the day number, and is hidden from assistive technology', () => {
    render(<DateTile date="2030-06-17T10:00:00" />)
    const tile = screen.getByTestId('date-tile')
    expect(tile).toHaveAttribute('aria-hidden', 'true')
    expect(tile).toHaveTextContent('17')
  })
})
