import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubSettingsCard } from './HubSettingsCard'

const on = {
  identityShown: true,
  contactShown: true,
  linksShown: true,
  logosShown: true,
  logoDownloadAllowed: false,
  directoryShown: true,
  directoryPhoneShown: true,
  directoryEmailShown: false,
}

const meta: Meta<typeof HubSettingsCard> = {
  title: 'Components/HubSettingsCard',
  component: HubSettingsCard,
  args: { settings: on, onChange: () => undefined },
}
export default meta

type Story = StoryObj<typeof HubSettingsCard>

export const DirectoryOn: Story = {}
export const DirectoryOff: Story = { args: { settings: { ...on, directoryShown: false, directoryPhoneShown: false, directoryEmailShown: false } } }
export const Loading: Story = { args: { settings: undefined, disabled: true } }
export const SaveFailed: Story = { args: { error: new Error('x') } }
