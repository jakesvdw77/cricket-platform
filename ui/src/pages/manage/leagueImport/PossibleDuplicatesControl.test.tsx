import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { emptyImportDecisions } from '../../../api/importApi'
import { PossibleDuplicatesControl } from './PossibleDuplicatesControl'

function renderControl(options: Record<string, unknown> = {}, setOptions = vi.fn()) {
  render(<PossibleDuplicatesControl decisions={{ ...emptyImportDecisions(), options }} issues={[]} setOptions={setOptions} disabled={false} />)
  return setOptions
}

describe('PossibleDuplicatesControl', () => {
  it('shows the default of 14 days, and the saved value when restored from the decisions', () => {
    renderControl()
    expect(screen.getByRole('button', { name: 'Possible duplicates: within 14 days' })).toBeInTheDocument()
  })

  it('is restored from decisions.options.windowDays', () => {
    renderControl({ windowDays: 30 })
    expect(screen.getByRole('button', { name: 'Possible duplicates: within 30 days' })).toBeInTheDocument()
  })

  it('applies once with options.windowDays', () => {
    const setOptions = renderControl()
    fireEvent.click(screen.getByRole('button', { name: /Possible duplicates/ }))
    expect(screen.getByText(/flagged as a possible duplicate/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Days'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(setOptions).toHaveBeenCalledTimes(1)
    expect(setOptions).toHaveBeenCalledWith({ windowDays: 30 })
  })

  it('blocks a value outside 1 to 60', () => {
    const setOptions = renderControl()
    fireEvent.click(screen.getByRole('button', { name: /Possible duplicates/ }))
    fireEvent.change(screen.getByLabelText('Days'), { target: { value: '99' } })
    expect(screen.getByText('Enter a number from 1 to 60')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    expect(setOptions).not.toHaveBeenCalled()
  })

  it('closes on Cancel and on Escape without saving', async () => {
    const setOptions = renderControl()
    fireEvent.click(screen.getByRole('button', { name: /Possible duplicates/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByLabelText('Days')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Possible duplicates/ }))
    fireEvent.keyDown(screen.getByLabelText('Days'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByLabelText('Days')).not.toBeInTheDocument())
    expect(setOptions).not.toHaveBeenCalled()
  })
})
