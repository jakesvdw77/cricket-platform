import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { describe, expect, it, vi } from 'vitest'
import { TimeField } from './TimeField'
import { baseTheme } from '../../theme'

function Harness({ initial = '', onValue }: { initial?: string; onValue?: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <ThemeProvider theme={baseTheme}>
      <TimeField
        label="Start time"
        ariaLabel="Start time, row 1"
        value={value}
        onChange={(next) => {
          setValue(next)
          onValue?.(next)
        }}
      />
    </ThemeProvider>
  )
}

const box = () => screen.getByLabelText('Start time, row 1')

describe('TimeField', () => {
  it('types digits with the colon inserted and refuses impossible values', () => {
    render(<Harness />)
    fireEvent.change(box(), { target: { value: '1330' } })
    expect(box()).toHaveValue('13:30')
    fireEvent.change(box(), { target: { value: '2599' } })
    expect(box()).toHaveValue('2')
  })

  it('steps with ArrowUp and ArrowDown without letting the key reach a parent', () => {
    const parent = vi.fn()
    render(<div onKeyDown={parent}><Harness initial="13:30" /></div>)
    fireEvent.keyDown(box(), { key: 'ArrowUp' })
    expect(box()).toHaveValue('13:45')
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    expect(box()).toHaveValue('13:15')
    expect(parent.mock.calls.every(([event]) => event.defaultPrevented)).toBe(true)
  })

  it('starts at 09:00 from empty and steps with the small arrows', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Start time, row 1: 15 minutes later' }))
    expect(box()).toHaveValue('09:00')
    fireEvent.click(screen.getByRole('button', { name: 'Start time, row 1: 15 minutes earlier' }))
    expect(box()).toHaveValue('08:45')
  })
})
