import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { ShareFormatsSettings } from './ShareFormatsSettings'

// docs/specs/122-league-sharing.md (Share formats): one switch per format and content type; the last format on cannot be
// switched off; a server refusal is shown.
const switchOf = (group: string, label: string) => {
  const fieldset = screen.getByRole('group', { name: group })
  const input = Array.from(fieldset.querySelectorAll('input')).find((el) => el.closest('label')?.textContent === label || el.getAttribute('aria-label') === label)
  if (!input) throw new Error(`no ${label} in ${group}`)
  return input as HTMLInputElement
}

describe('ShareFormatsSettings', () => {
  it('shows every format on when nothing is disabled, grouped by content type', () => {
    render(<ShareFormatsSettings disabledFormats={{}} onChange={vi.fn()} />)

    expect(screen.getAllByRole('checkbox').length + screen.queryAllByRole('switch').length).toBe(10)
    expect(switchOf('Leagues', 'Calendar').checked).toBe(true)
    expect(switchOf('Results', 'TV summary').checked).toBe(true)
  })

  it('switching a format off passes the whole new map, keeping the other content type', async () => {
    const onChange = vi.fn()
    render(<ShareFormatsSettings disabledFormats={{ RESULT: ['TV'] }} onChange={onChange} />)

    await userEvent.click(switchOf('Leagues', 'Poster'))
    expect(onChange).toHaveBeenCalledWith({ RESULT: ['TV'], LEAGUE: ['POSTER'] })
  })

  it('switching a format back on removes it from the map', async () => {
    const onChange = vi.fn()
    render(<ShareFormatsSettings disabledFormats={{ LEAGUE: ['POSTER', 'CALENDAR'] }} onChange={onChange} />)

    expect(switchOf('Leagues', 'Poster').checked).toBe(false)
    await userEvent.click(switchOf('Leagues', 'Poster'))
    expect(onChange).toHaveBeenCalledWith({ LEAGUE: ['CALENDAR'] })
  })

  it('will not switch off the last format on for a content type, and says why', () => {
    render(<ShareFormatsSettings disabledFormats={{ LEAGUE: ['PDF', 'POSTER', 'CALENDAR', 'FACEBOOK'] }} onChange={vi.fn()} />)

    expect(switchOf('Leagues', 'WhatsApp').checked).toBe(true)
    expect(switchOf('Leagues', 'WhatsApp').disabled).toBe(true)
    expect(screen.getByText(/Leagues need at least one format/)).toBeInTheDocument()
    // The other content type is unaffected.
    expect(switchOf('Results', 'PDF').disabled).toBe(false)
  })

  it('shows the server message when a save is refused, and a fallback otherwise', () => {
    const refused = new AxiosError('bad', '400', undefined, undefined, { status: 400, data: { detail: 'Leagues need at least one share format.' } } as never)
    const { rerender } = render(<ShareFormatsSettings disabledFormats={{}} onChange={vi.fn()} error={refused} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Leagues need at least one share format.')

    rerender(<ShareFormatsSettings disabledFormats={{}} onChange={vi.fn()} error={new Error('x')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save the share formats.')
  })

  it('disables every switch while saving', () => {
    render(<ShareFormatsSettings disabledFormats={{}} onChange={vi.fn()} disabled />)
    expect(switchOf('Leagues', 'PDF').disabled).toBe(true)
  })
})
