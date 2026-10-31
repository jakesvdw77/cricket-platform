import type { Meta, StoryObj } from '@storybook/react-vite'
import { LogoAvatar } from './LogoAvatar'

const meta: Meta<typeof LogoAvatar> = { title: 'Components/LogoAvatar', component: LogoAvatar, args: { size: 56, children: 'IV' } }
export default meta
type Story = StoryObj<typeof LogoAvatar>

export const Initials: Story = {}
export const BrokenImage: Story = { args: { src: '/missing.png', variant: 'rounded' } }
export const PersonInitials: Story = { args: { kind: 'person', children: 'JS', variant: 'circular' } }
