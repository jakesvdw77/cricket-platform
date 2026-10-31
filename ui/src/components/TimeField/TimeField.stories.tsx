import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TimeField } from './TimeField'
import type { TimeFieldProps } from './TimeField'

function Demo({ initial = '', ...rest }: Partial<TimeFieldProps> & { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <div style={{ maxWidth: 160 }}>
      <TimeField label="Start time" ariaLabel="Start time" value={value} onChange={setValue} {...rest} />
    </div>
  )
}

const meta: Meta = { title: 'Components/TimeField' }
export default meta

export const Empty: StoryObj = { render: () => <Demo /> }
export const WithValue: StoryObj = { render: () => <Demo initial="13:30" /> }
export const WithError: StoryObj = { render: () => <Demo initial="13:3" error /> }
export const Disabled: StoryObj = { render: () => <Demo initial="13:30" disabled /> }
