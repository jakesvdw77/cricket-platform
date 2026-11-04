import type { Meta, StoryObj } from '@storybook/react-vite'
import { SplitButton } from './SplitButton'

const meta: Meta<typeof SplitButton> = {
  title: 'Components/SplitButton',
  component: SplitButton,
  args: {
    label: 'Capture New Result',
    onClick: () => undefined,
    items: [
      { id: 'import', label: 'Import Result', onClick: () => undefined },
    ],
  },
}
export default meta

export const Default: StoryObj<typeof SplitButton> = {}

// One related action only.
export const SingleRelated: StoryObj<typeof SplitButton> = {
  args: { items: [{ id: 'import', label: 'Import Result', onClick: () => undefined }] },
}
