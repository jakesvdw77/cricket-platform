import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReconcileStrip } from './ReconcileStrip'
import { baseTheme } from '../../theme'

const renderStrip = (ui: React.ReactElement) => render(<ThemeProvider theme={baseTheme}>{ui}</ThemeProvider>)

describe('ReconcileStrip', () => {
  it('reads as a status with the figures and the verdict in words', () => {
    renderStrip(<ReconcileStrip tone="ok" title="Total 148 = 135 off the bat + 13 extras" status="matches the innings total" />)

    const strip = screen.getByRole('status')
    expect(strip).toHaveTextContent('Total 148 = 135 off the bat + 13 extras')
    expect(strip).toHaveTextContent('matches the innings total')
  })

  it('draws the meter in the primary colour when ok and amber in the warning state', () => {
    const progress = { value: 4, max: 6, ariaLabel: 'Out', valueText: 'Out 4 of 6' }
    const { rerender } = renderStrip(<ReconcileStrip tone="ok" title="Out 4 of 6" progress={progress} />)
    expect(screen.getByRole('progressbar', { name: 'Out' })).toHaveAttribute('aria-valuenow', '4')
    expect(screen.getByTestId('selection-bar-fill')).toHaveStyle({ backgroundColor: baseTheme.palette.primary.main })

    rerender(
      <ThemeProvider theme={baseTheme}>
        <ReconcileStrip tone="warning" title="Out 7 of 6" status="1 more than the result says" progress={{ ...progress, value: 7 }} />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('selection-bar-fill')).toHaveStyle({ backgroundColor: baseTheme.palette.warning.main })
    expect(screen.getByRole('status')).toHaveTextContent('1 more than the result says')
  })

  it('shows an optional detail line and no meter without progress', () => {
    renderStrip(<ReconcileStrip tone="neutral" title="Balls 238 of 240" detail="Byes are not charged to a bowler" />)

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText('Byes are not charged to a bowler')).toBeInTheDocument()
  })
})
