import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { emptyImportDecisions } from '../../../api/importApi'
import type { ImportIssue } from '../../../api/importApi'
import { ExtendLeagueDatesControl } from './ExtendLeagueDatesControl'
import { describeLeagueDatesChange } from './scheduleCandidates'

const issue = (code: string) => ({ code, severity: 'ERROR', rowNumbers: [2], message: 'm', hint: null }) as unknown as ImportIssue

function renderControl(issues: ImportIssue[], options: Record<string, unknown> = {}, setOptions = vi.fn()) {
  render(<ExtendLeagueDatesControl decisions={{ ...emptyImportDecisions(), options }} issues={issues} setOptions={setOptions} disabled={false} />)
  return setOptions
}

describe('ExtendLeagueDatesControl', () => {
  it('shows nothing without a DATE_OUTSIDE_LEAGUE_DATES issue', () => {
    renderControl([issue('DATE_OUTSIDE_SEASON')])
    expect(screen.queryByRole('button', { name: 'Extend league dates' })).not.toBeInTheDocument()
  })

  it('saves one options update when pressed', () => {
    const setOptions = renderControl([issue('DATE_OUTSIDE_LEAGUE_DATES')])
    fireEvent.click(screen.getByRole('button', { name: 'Extend league dates' }))
    expect(setOptions).toHaveBeenCalledTimes(1)
    expect(setOptions).toHaveBeenCalledWith({ extendLeagueDates: true })
  })

  it('shows the chip and Undo once set', () => {
    const setOptions = renderControl([], { extendLeagueDates: true })
    expect(screen.getByText('League dates will be extended')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(setOptions).toHaveBeenCalledWith({ extendLeagueDates: false })
  })
})

describe('describeLeagueDatesChange', () => {
  it('words both dates', () => {
    expect(describeLeagueDatesChange({ start: { old: '2026-10-01', new: '2026-10-01' }, end: { old: '2027-03-31', new: '2027-04-30' } })).toBe(
      'League dates: 1 Oct 2026 to 31 Mar 2027 becomes 1 Oct 2026 to 30 Apr 2027',
    )
  })
  it('handles a change of the start only', () => {
    expect(describeLeagueDatesChange({ start: { old: '2026-10-01', new: '2026-08-15' }, end: { old: '2027-03-31', new: '2027-03-31' } })).toBe(
      'League dates: 1 Oct 2026 to 31 Mar 2027 becomes 15 Aug 2026 to 31 Mar 2027',
    )
  })
})
