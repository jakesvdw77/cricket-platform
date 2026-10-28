import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShareFormatsSettings } from './ShareFormatsSettings'

const meta: Meta<typeof ShareFormatsSettings> = {
  title: 'Components/ShareFormatsSettings',
  component: ShareFormatsSettings,
  args: { disabledFormats: {}, onChange: () => undefined },
}
export default meta

type Story = StoryObj<typeof ShareFormatsSettings>

export const AllOn: Story = {}
export const SomeOff: Story = { args: { disabledFormats: { RESULT: ['TV'], LEAGUE: ['POSTER', 'CALENDAR', 'WHATSAPP', 'FACEBOOK'] } } }
export const ServerRefusal: Story = { args: { error: new Error('x') } }
export const Saving: Story = { args: { disabled: true } }
