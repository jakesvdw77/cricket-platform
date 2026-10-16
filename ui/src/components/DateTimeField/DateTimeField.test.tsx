import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { describe, expect, it, vi } from 'vitest'
import { DateTimeField } from './DateTimeField'
import type { DateTimeFieldProps } from './DateTimeField'
import { baseTheme } from '../../theme'
import { STEP_MINUTES } from '../../utils/timeInput'

function Harness({ initial = '', onValue, ...rest }: Partial<DateTimeFieldProps> & { initial?: string; onValue?: (v: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <ThemeProvider theme={baseTheme}>
      <DateTimeField
        label="Closes at"
        value={value}
        onChange={(next) => {
          setValue(next)
          onValue?.(next)
        }}
        {...rest}
      />
    </ThemeProvider>
  )
}

const time = () => screen.getByLabelText('Closes at (time)')
const date = () => screen.getByLabelText('Closes at (date)')

describe('DateTimeField', () => {
  it('is a labelled group with a date input and a time input', () => {
    render(<Harness />)

    expect(screen.getByRole('group', { name: 'Closes at' })).toBeInTheDocument()
    expect(date()).toHaveAttribute('type', 'date')
    expect(time()).toHaveAttribute('inputmode', 'numeric')
  })

  it('round-trips a full value into the date and time inputs', () => {
    render(<Harness initial="2026-10-11T13:00" />)

    expect(date()).toHaveValue('2026-10-11')
    expect(time()).toHaveValue('13:00')
  })

  it('keeps a date-only value and shows the time empty', () => {
    render(<Harness initial="2026-10-11" />)

    expect(date()).toHaveValue('2026-10-11')
    expect(time()).toHaveValue('')
  })

  it('turns 1300 into 13:00 and emits the full value', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness initial="2026-10-11" onValue={onValue} />)

    await user.type(time(), '1300')

    expect(time()).toHaveValue('13:00')
    expect(onValue).toHaveBeenLastCalledWith('2026-10-11T13:00')
  })

  it('turns 930 into 09:30', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2026-10-11" />)

    await user.type(time(), '930')

    expect(time()).toHaveValue('09:30')
  })

  it('turns 9 then 30 into 09:30', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2026-10-11" />)

    await user.type(time(), '9')
    expect(time()).toHaveValue('09')
    await user.type(time(), '30')

    expect(time()).toHaveValue('09:30')
  })

  it('refuses hours above 23 and minutes above 59', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2026-10-11" />)

    await user.type(time(), '27')
    expect(time()).toHaveValue('2')
    await user.clear(time())
    await user.type(time(), '1275')
    expect(time()).toHaveValue('12:5')
    await user.type(time(), '9')
    expect(time()).toHaveValue('12:59')
  })

  it('strips anything that is not a digit', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2026-10-11" />)

    await user.type(time(), 'ab1:x3')

    expect(time()).toHaveValue('13')
  })

  it('emits an empty value until both the date and a complete time are set', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness onValue={onValue} />)

    await user.type(time(), '1300')
    expect(onValue).not.toHaveBeenCalled()
    expect(time()).toHaveValue('13:00')

    fireEvent.change(date(), { target: { value: '2026-06-01' } })
    expect(onValue).toHaveBeenLastCalledWith('2026-06-01T13:00')

    await user.type(time(), '{Backspace}')
    expect(onValue).toHaveBeenLastCalledWith('')
    expect(date()).toHaveValue('2026-06-01')
  })

  it('follows a value changed from outside', () => {
    const { rerender } = render(
      <ThemeProvider theme={baseTheme}>
        <DateTimeField label="Closes at" value="2026-10-11T13:00" onChange={() => undefined} />
      </ThemeProvider>,
    )
    rerender(
      <ThemeProvider theme={baseTheme}>
        <DateTimeField label="Closes at" value="2026-10-12T09:15" onChange={() => undefined} />
      </ThemeProvider>,
    )

    expect(date()).toHaveValue('2026-10-12')
    expect(time()).toHaveValue('09:15')
  })

  it('disables every control', () => {
    render(<Harness initial="2026-10-11T13:00" disabled />)

    expect(date()).toBeDisabled()
    expect(time()).toBeDisabled()
      })

  it('shows the helper or error text', () => {
    render(<Harness error helperText="Choose a closing time in the future." />)

    expect(screen.getByText('Choose a closing time in the future.')).toBeInTheDocument()
  })

  it('passes min and max to the date input and the test id to the group', () => {
    render(<Harness min="2026-01-01T00:00" max="2026-12-31" data-testid="close" />)

    expect(date()).toHaveAttribute('min', '2026-01-01')
    expect(date()).toHaveAttribute('max', '2026-12-31')
    expect(screen.getByTestId('close')).toBe(screen.getByRole('group', { name: 'Closes at' }))
  })

  describe('stepper', () => {
    const later = () => screen.getByRole('button', { name: `Closes at: ${STEP_MINUTES} minutes later` })
    const earlier = () => screen.getByRole('button', { name: `Closes at: ${STEP_MINUTES} minutes earlier` })

    it('the arrows step to the next and previous quarter hour', async () => {
      const user = userEvent.setup()
      const onValue = vi.fn()
      render(<Harness initial="2026-10-11T13:10" onValue={onValue} />)

      await user.click(later())
      expect(time()).toHaveValue('13:15')
      await user.click(later())
      expect(time()).toHaveValue('13:30')
      await user.click(earlier())
      expect(time()).toHaveValue('13:15')
      expect(onValue).toHaveBeenLastCalledWith('2026-10-11T13:15')
    })

    it('ArrowUp and ArrowDown step the time, wrapping within the day', async () => {
      const user = userEvent.setup()
      render(<Harness initial="2026-10-11T23:50" />)

      await user.click(time())
      await user.keyboard('{ArrowUp}')
      expect(time()).toHaveValue('00:00')
      await user.keyboard('{ArrowDown}')
      expect(time()).toHaveValue('23:45')
    })

    it('starts at 09:00 when the time is empty, and sets the time without assuming a date', async () => {
      const user = userEvent.setup()
      const onValue = vi.fn()
      render(<Harness onValue={onValue} />)

      await user.click(earlier())

      expect(time()).toHaveValue('09:00')
      expect(date()).toHaveValue('')
      expect(onValue).not.toHaveBeenCalled()
    })

    it('is disabled with the field', () => {
      render(<Harness initial="2026-10-11T13:00" disabled />)
      expect(later()).toBeDisabled()
      expect(earlier()).toBeDisabled()
    })
  })

  it('renders no quick time buttons', () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: /^Set Closes at to/ })).not.toBeInTheDocument()
  })
})
