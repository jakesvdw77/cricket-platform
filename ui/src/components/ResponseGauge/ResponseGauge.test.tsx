import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { describe, expect, it } from 'vitest'
import { ResponseGauge } from './ResponseGauge'
import type { ResponseGaugeProps } from './ResponseGauge'
import { baseTheme } from '../../theme'

function renderGauge(props: ResponseGaugeProps) {
  return render(
    <ThemeProvider theme={baseTheme}>
      <ResponseGauge {...props} />
    </ThemeProvider>,
  )
}

describe('ResponseGauge', () => {
  it('poll mode shows answered all / some / none with counts and no "N of M"', () => {
    renderGauge({ mode: 'poll', coverage: { all: 12, some: 3, none: 3 } })

    const gauge = screen.getByRole('group', { name: 'Response summary' })
    expect(gauge).toHaveTextContent('12answered all')
    expect(gauge).toHaveTextContent('3some')
    expect(gauge).toHaveTextContent('3none')
    expect(screen.queryByText(/of \d+ answered/)).not.toBeInTheDocument()
    expect(getComputedStyle(screen.getByTestId('response-gauge-bar-all')).width).toMatch(/^66\.6/)
  })

  it('status mode shows the four statuses and "N of M answered"', () => {
    renderGauge({ mode: 'status', counts: { available: 8, unsure: 2, unavailable: 3, noResponse: 5 } })

    expect(screen.getByText('13 of 18 answered')).toBeInTheDocument()
    for (const legend of ['Available 8', 'Unsure 2', 'Unavailable 3', 'No response 5']) {
      expect(document.querySelector(`[data-legend="${legend}"]`)).not.toBeNull()
    }
  })

  it('draws nothing wide when there is nobody', () => {
    renderGauge({ mode: 'status', counts: { available: 0, unsure: 0, unavailable: 0, noResponse: 0 } })

    expect(screen.getByText('0 of 0 answered')).toBeInTheDocument()
    expect(getComputedStyle(screen.getByTestId('response-gauge-bar-AVAILABLE')).width).toBe('0px')
  })

  it('thin variant is a bar alone, named with the four counts', () => {
    renderGauge({ mode: 'status', variant: 'thin', testIdPrefix: 'w1', counts: { available: 8, unsure: 2, unavailable: 3, noResponse: 5 } })

    expect(screen.getByRole('img', { name: '8 Available, 2 Unsure, 3 Unavailable, 5 No response' })).toBeInTheDocument()
    expect(screen.queryByText(/answered/)).not.toBeInTheDocument()
    expect(screen.getByTestId('w1-bar-NONE')).toBeInTheDocument()
  })
})
