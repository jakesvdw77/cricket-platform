import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DateTimeField } from './DateTimeField'
import type { DateTimeFieldProps } from './DateTimeField'

function Demo(props: Partial<DateTimeFieldProps> & { initial?: string }) {
  const { initial = '', ...rest } = props
  const [value, setValue] = useState(initial)
  return (
    <div style={{ maxWidth: 360 }}>
      <DateTimeField label="Match date & time" value={value} onChange={setValue} {...rest} />
    </div>
  )
}

const meta: Meta = { title: 'Components/DateTimeField' }
export default meta

export const Empty: StoryObj = { render: () => <Demo /> }
export const WithValue: StoryObj = { render: () => <Demo initial="2026-10-11T13:00" /> }
export const DateOnly: StoryObj = { render: () => <Demo initial="2026-10-11" /> }
export const WithError: StoryObj = {
  render: () => <Demo initial="2020-01-01T09:00" error helperText="Choose a closing time in the future." />,
}
export const Disabled: StoryObj = {
  render: () => <Demo initial="2026-10-11T13:00" disabled helperText="The poll stays open until you close it." />,
}
