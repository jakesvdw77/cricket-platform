import type { Meta, StoryObj } from '@storybook/react-vite'
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined'
import { RecordCard } from './RecordCard'

// No local MemoryRouter decorator here — .storybook/preview.tsx already wraps every story in one
// globally; adding a second nested <MemoryRouter> throws ("You cannot render a <Router> inside
// another <Router>") and was breaking every story (including pre-existing ones) under Storybook's
// interaction-test runner.
const meta: Meta<typeof RecordCard> = {
  title: 'Components/RecordCard',
  component: RecordCard,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof RecordCard>

export const Active: Story = {
  args: {
    title: 'Club Standard',
    badge: { label: 'Active', tone: 'positive' },
    description: 'Everything a growing club needs to run sections, teams, and fixtures.',
    fields: [
      { label: 'Price', value: 'USD 49.99/month' },
      { label: 'Code', value: 'CLUB_STANDARD' },
    ],
    chips: ['5 sections', '10 teams', '200 players'],
    editLabel: 'Edit',
    onEdit: () => undefined,
  },
}

export const Draft: Story = {
  args: {
    title: 'Club Pro',
    badge: { label: 'Draft', tone: 'neutral' },
    description: 'A higher tier still being defined.',
    fields: [
      { label: 'Price', value: 'USD 99.99/month' },
      { label: 'Code', value: 'CLUB_PRO' },
    ],
    chips: ['Unlimited sections', 'Unlimited teams', 'Unlimited players'],
    editLabel: 'Edit',
    onEdit: () => undefined,
  },
}

export const RetiredWithLink: Story = {
  args: {
    title: 'League Operator',
    badge: { label: 'Retired', tone: 'muted' },
    description: 'No longer offered to new subscribers.',
    fields: [{ label: 'Price', value: 'Free' }, { label: 'Code', value: 'LEAGUE_OPERATOR' }],
    editLabel: 'Edit',
    editTo: '/admin/configuration/products/p-1/edit',
  },
}

export const MinimalSlots: Story = {
  args: {
    title: 'Club Free',
    editLabel: 'Edit',
    onEdit: () => undefined,
  },
}

// docs/specs/019-resend-subscription-welcome-email.md's RecordCard extension — a second footer
// action alongside Edit, plus an inline outcome message. Generic props, demonstrated here with
// a Subscription-shaped example since that's this spec's real consumer, but nothing about the
// props themselves is Subscription-specific.
export const WithSecondaryActionAndFeedback: Story = {
  args: {
    title: 'Riverside CC',
    badge: { label: 'Active', tone: 'positive' },
    description: 'Club Standard',
    fields: [
      { label: 'Product code', value: 'CLUB_STANDARD' },
      { label: 'Start date', value: '2026-01-01' },
    ],
    editLabel: 'Edit',
    editTo: '/admin/billing/s-1/edit',
    secondaryAction: {
      label: 'Resend welcome email',
      pendingLabel: 'Sending…',
      pending: false,
      onClick: () => undefined,
    },
    feedback: {
      message: 'Welcome email resent to jaco@example.com.',
      tone: 'success',
    },
  },
}

// The avatar slot — a photo/logo when the record has one, initials otherwise. Circular for a
// person-shaped record (a Contact, a Player), rounded for an organisation/named-thing a logo
// actually belongs to (a Team, a Sponsor, a Club) — see RecordCardAvatar's own doc comment.
export const WithPhotoAvatar: Story = {
  args: {
    title: 'Jane Smith',
    avatar: { imageUrl: 'https://i.pravatar.cc/80?img=47', fallback: 'JA', shape: 'circular' },
    badge: { label: 'Active', tone: 'positive' },
    description: 'Club Treasurer',
    fields: [
      { label: 'Email', value: 'jane.smith@example.com' },
      { label: 'Phone', value: '+27 82 555 0101' },
    ],
    editLabel: 'Edit',
    editTo: '/manage/club-contacts/c-1/edit',
    secondaryAction: {
      label: 'Deactivate',
      pendingLabel: 'Deactivating…',
      pending: false,
      onClick: () => undefined,
      icon: <ToggleOffOutlinedIcon fontSize="small" />,
    },
  },
}

export const WithInitialsAvatar: Story = {
  args: {
    title: '1st XI',
    avatar: { fallback: '1S', shape: 'rounded' },
    badge: { label: 'Active', tone: 'positive' },
    description: 'Juniors > Boys > O/15',
    editLabel: 'Edit',
    editTo: '/manage/teams/t-1/edit',
  },
}

// docs/specs/008-product-catalog.md's Test Plan requires a story at each of 375/768/1280.
export const MobileViewport: Story = {
  args: Active.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Active.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Active.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
