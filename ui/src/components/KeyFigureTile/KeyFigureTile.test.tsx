import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeyFigureTile } from './KeyFigureTile'

describe('KeyFigureTile', () => {
  it('shows the value and the caption', () => {
    render(<KeyFigureTile testId="tile" icon={<span />} value="12" label="Games this season" />)
    expect(screen.getByTestId('tile-value')).toHaveTextContent('12')
    expect(screen.getByText('Games this season')).toBeInTheDocument()
    expect(screen.getByTestId('tile')).toHaveAttribute('data-tone', 'neutral')
  })

  it('marks the warning tone', () => {
    render(<KeyFigureTile testId="tile" icon={<span />} value="Thu 15 Oct" label="Starts 07:15" tone="warning" />)
    expect(screen.getByTestId('tile')).toHaveAttribute('data-tone', 'warning')
  })
})
