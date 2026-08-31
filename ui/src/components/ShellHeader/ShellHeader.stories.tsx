import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShellHeader } from './ShellHeader'

const meta: Meta<typeof ShellHeader> = {
  title: 'Components/ShellHeader',
  component: ShellHeader,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof ShellHeader>

const args = {
  brand: 'Cricket Legend Platform',
  user: { name: 'Ada Lovelace', email: 'ada@example.com' },
  onLogout: () => {},
  profileTo: '/admin/profile',
}

export const Mobile: Story = {
  args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const Tablet: Story = {
  args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const Desktop: Story = {
  args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}

// docs/specs/006-post-login-home-shells.md's Manager shell (GridNavShell/ManagerHome) shows the
// managed club's own branding instead of the generic platform name — the club logo when set.
export const WithClubLogo: Story = {
  args: {
    brand: 'Riverside Cricket Club',
    user: { name: 'Sam Manager', email: 'sam@riverside.example.com' },
    onLogout: () => {},
    profileTo: '/manage/profile',
    logoUrl: 'https://i.pravatar.cc/64?img=12',
  },
}

// A real club with no logo uploaded yet still gets the avatar slot — falls back to the same
// initials treatment RecordCard's own avatar already uses for Team/Sponsor/Club Contact.
export const WithClubInitialsFallback: Story = {
  args: {
    brand: 'Riverside Cricket Club',
    user: { name: 'Sam Manager', email: 'sam@riverside.example.com' },
    onLogout: () => {},
    profileTo: '/manage/profile',
    logoUrl: null,
  },
}
