import { fireEvent, screen } from '@testing-library/react'
import { expect } from 'vitest'

// Test helpers for components/DateTimeField: the value is the old datetime-local string
// ('YYYY-MM-DDTHH:mm', or '' for nothing), spread over the date input and the time input.
export function dateTimeInputs(label: string) {
  return {
    date: screen.getByLabelText(`${label} (date)`),
    time: screen.getByLabelText(`${label} (time)`),
  }
}

export function setDateTime(label: string, value: string) {
  const { date, time } = dateTimeInputs(label)
  const [datePart = '', timePart = ''] = value.split('T')
  fireEvent.change(date, { target: { value: datePart } })
  fireEvent.change(time, { target: { value: timePart } })
}

export function expectDateTime(label: string, value: string) {
  const { date, time } = dateTimeInputs(label)
  const [datePart = '', timePart = ''] = value.split('T')
  expect(date).toHaveValue(datePart)
  expect(time).toHaveValue(timePart)
}
