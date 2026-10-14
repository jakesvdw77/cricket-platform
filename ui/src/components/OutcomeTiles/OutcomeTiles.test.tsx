import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OutcomeTiles } from './OutcomeTiles'

describe('OutcomeTiles', () => {
  it('marks the chosen outcome and reports another', async () => {
    const onChange = vi.fn()
    render(<OutcomeTiles value="WON" onChange={onChange} />)

    expect(screen.getByRole('radio', { name: /Won/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: /Abandoned/ }))
    expect(onChange).toHaveBeenCalledWith('ABANDONED')
  })

  it('offers all six outcomes and ignores taps while disabled', async () => {
    const onChange = vi.fn()
    render(<OutcomeTiles value={null} onChange={onChange} disabled />)

    expect(screen.getAllByRole('radio').map((tile) => tile.textContent)).toEqual([
      'WonOne side won',
      'TieScores level',
      'DrawTime ran out',
      'No resultNot enough play',
      'AbandonedWeather or ground',
      'ForfeitA side conceded',
    ])
    for (const tile of screen.getAllByRole('radio')) expect(tile).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
  })
})
