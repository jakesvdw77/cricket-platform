import { useState } from 'react'
import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { JsonEditor } from './JsonEditor'

const SAMPLE = `{
  "schemaVersion": 1,
  "source": { "provider": "EXAMPLE", "externalMatchId": "m-1" },
  "teams": [ { "key": "A", "name": "Northgate Strollers" }, { "key": "B", "name": "Riverside Occasionals" } ],
  "innings": [ { "battingTeam": "A", "runs": 101, "wickets": 3, "overs": "20.0", "extras": null } ],
  "result": { "outcome": "WON", "winner": "B", "final": true }
}`

function Controlled(args: ComponentProps<typeof JsonEditor>) {
  const [value, setValue] = useState(args.value)
  return <JsonEditor {...args} value={value} onChange={setValue} />
}

const meta: Meta<typeof JsonEditor> = {
  title: 'Components/JsonEditor',
  component: JsonEditor,
  args: { ariaLabel: 'Pasted result content', placeholder: 'Paste the result here', value: '', onChange: () => undefined },
  render: (args) => <Controlled {...args} />,
}
export default meta

type Story = StoryObj<typeof JsonEditor>

export const Empty: Story = {}
export const WithJson: Story = { args: { value: SAMPLE } }
export const WithError: Story = { args: { value: SAMPLE, error: true } }
export const Disabled: Story = { args: { value: SAMPLE, disabled: true } }
