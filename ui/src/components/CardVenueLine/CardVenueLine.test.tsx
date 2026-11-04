import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardVenueLine } from './CardVenueLine'

describe('CardVenueLine', () => {
  it('shows the venue with a trailing control at the right end', () => {
    render(<CardVenueLine trailing={<button type="button">Go</button>}>Laudium Oval</CardVenueLine>)
    expect(screen.getByTestId('card-venue-line')).toHaveTextContent('Laudium Oval')
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument()
  })
})
