import type { Meta, StoryObj } from '@storybook/react-vite'
import { WizardFooter } from './WizardFooter'

const meta: Meta<typeof WizardFooter> = {
  title: 'Components/WizardFooter',
  component: WizardFooter,
  args: {
    back: { label: 'Back', onClick: () => {} },
    secondary: { label: 'Save draft', onClick: () => {} },
    primary: { label: 'Next: Batting', onClick: () => {} },
  },
}
export default meta

type Story = StoryObj<typeof WizardFooter>

export const Default: Story = {}

export const FirstStep: Story = { args: { back: undefined, note: 'Nothing is saved at this step.' } }
