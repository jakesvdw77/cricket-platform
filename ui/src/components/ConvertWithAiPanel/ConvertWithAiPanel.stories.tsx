import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConvertWithAiPanel } from './ConvertWithAiPanel'

const meta: Meta<typeof ConvertWithAiPanel> = {
  title: 'Components/ConvertWithAiPanel',
  component: ConvertWithAiPanel,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ConvertWithAiPanel>

const PROMPT = 'You are helping a cricket club fill in an import template.\n\n1. Read the attached fixture list.\n2. Fill one row per match using the attached template.\n3. Return it as an Excel file.'

const noop = () => undefined

export const Open: Story = { args: { prompt: PROMPT, open: true, onClose: noop, onDownloadTemplate: noop } }
export const Loading: Story = { args: { loading: true, open: true, onClose: noop } }
export const LoadFailed: Story = { args: { error: true, open: true, onClose: noop, onRetry: noop } }
export const Phone: Story = { args: { prompt: PROMPT, open: true, onClose: noop, onDownloadTemplate: noop }, parameters: { viewport: { defaultViewport: 'mobile1' } } }
