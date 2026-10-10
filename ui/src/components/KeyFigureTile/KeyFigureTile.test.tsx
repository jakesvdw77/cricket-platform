import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

  it('is a plain tile, not a button, without onClick', () => {
    render(<KeyFigureTile testId="tile" icon={<span />} value="12" label="Games" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('becomes a labelled picker button when onClick is given', async () => {
    const onClick = vi.fn()
    render(<KeyFigureTile testId="tile" icon={<span />} value="Ann" label="Captain" onClick={onClick} ariaLabel="Captain: Ann, change" />)
    await userEvent.click(screen.getByRole('button', { name: 'Captain: Ann, change' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn()
    render(<KeyFigureTile icon={<span />} value="Ann" label="Captain" onClick={onClick} ariaLabel="Captain" disabled />)
    await userEvent.click(screen.getByRole('button', { name: 'Captain' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
