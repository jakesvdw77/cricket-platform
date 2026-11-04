import type { Meta, StoryObj } from '@storybook/react-vite'
import { HeaderShareButton } from './HeaderShareButton'

const meta: Meta<typeof HeaderShareButton> = {
  title: 'Components/HeaderShareButton',
  component: HeaderShareButton,
  args: { onClick: () => undefined },
}
export default meta

export const Default: StoryObj<typeof HeaderShareButton> = {}
