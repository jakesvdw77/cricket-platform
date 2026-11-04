import type { Meta, StoryObj } from '@storybook/react-vite'
import { CardVenueLine } from './CardVenueLine'

const meta: Meta<typeof CardVenueLine> = { title: 'Components/CardVenueLine', component: CardVenueLine, args: { children: 'Laudium Oval' } }
export default meta

type Story = StoryObj<typeof CardVenueLine>

export const Default: Story = {}
