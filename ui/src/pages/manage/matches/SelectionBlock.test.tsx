import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SelectionBlock } from './SelectionBlock'

describe('SelectionBlock', () => {
  it('shows "N of M picked", a determinate bar and "N picked · K to go"', () => {
    render(<SelectionBlock rows={[{ teamName: '1st XI', picked: 7, playingXiSize: 11 }]} />)

    expect(screen.getByText('1st XI')).toBeInTheDocument()
    expect(screen.getByText('7 of 11 picked')).toBeInTheDocument()
    expect(screen.getByText('7 picked · 4 to go')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', { name: '1st XI selection' })
    expect(bar).toHaveAttribute('aria-valuenow', '7')
    expect(bar).toHaveAttribute('aria-valuemax', '11')
    expect(bar).toHaveAttribute('aria-valuetext', '7 of 11 picked')
    expect(within(bar).getByTestId('selection-bar-fill')).toHaveStyle({ width: `${(7 / 11) * 100}%` })
  })

  it('reads "squad complete" at M of M', () => {
    render(<SelectionBlock rows={[{ teamName: '1st XI', picked: 11, playingXiSize: 11 }]} />)

    expect(screen.getByText('11 of 11 picked')).toBeInTheDocument()
    expect(screen.getByText('squad complete')).toBeInTheDocument()
    expect(screen.queryByText(/to go/)).not.toBeInTheDocument()
    expect(screen.getByTestId('selection-bar-fill')).toHaveStyle({ width: '100%' })
  })

  it('shows an empty bar and every player still to go at zero picked', () => {
    render(<SelectionBlock rows={[{ teamName: '1st XI', picked: 0, playingXiSize: 11 }]} />)

    expect(screen.getByText('0 picked · 11 to go')).toBeInTheDocument()
    expect(screen.getByTestId('selection-bar-fill')).toHaveStyle({ width: '0%' })
  })

  it('shows just "N picked" with no bar when there is no league', () => {
    render(<SelectionBlock rows={[{ teamName: '1st XI', picked: 5, playingXiSize: null }]} />)

    expect(screen.getByText('5 picked')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/of \d+ picked/)).not.toBeInTheDocument()
  })

  it('renders one row per team for a derby', () => {
    render(
      <SelectionBlock
        rows={[
          { teamName: '1st XI', picked: 11, playingXiSize: 11 },
          { teamName: '2nd XI', picked: 3, playingXiSize: 11 },
        ]}
      />,
    )

    expect(screen.getAllByRole('progressbar')).toHaveLength(2)
    expect(screen.getByText('11 of 11 picked')).toBeInTheDocument()
    expect(screen.getByText('3 of 11 picked')).toBeInTheDocument()
  })

  it('shows the nobody-to-pick note when there are no rows', () => {
    render(<SelectionBlock rows={[]} />)

    expect(screen.getByText('Neither side is one of your teams, so there is nobody to pick.')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
