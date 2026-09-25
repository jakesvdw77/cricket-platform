import type { Meta, StoryObj } from '@storybook/react-vite'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import { RecordQuickViewDialog } from './RecordQuickViewDialog'

// No local MemoryRouter decorator here — .storybook/preview.tsx already wraps every story in one
// globally, same precedent as RecordCard.stories.tsx/RecordDetailScreen.stories.tsx.
const meta: Meta<typeof RecordQuickViewDialog> = {
  title: 'Components/RecordQuickViewDialog',
  component: RecordQuickViewDialog,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof RecordQuickViewDialog>

// Contact-shaped: circular avatar fallback, role as subtitle, Email/Phone fields.
export const ContactQuickView: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    avatar: { fallback: 'JA', shape: 'circular' },
    title: 'Jane Smith',
    subtitle: 'Club Secretary',
    fields: [
      { icon: <EmailOutlinedIcon />, label: 'Email', value: 'jane.smith@example.com' },
      { icon: <PhoneOutlinedIcon />, label: 'Phone', value: '+27 82 555 0101' },
    ],
    editTo: '/manage/club-contacts/c-1/edit',
  },
}

// Sponsor-shaped: rounded/logo avatar, Website/Email fields, no subtitle.
export const SponsorQuickView: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    avatar: { fallback: 'AC', shape: 'rounded' },
    title: 'Acme Cricket Gear',
    fields: [
      { icon: <LanguageOutlinedIcon />, label: 'Website', value: 'acmecricket.example' },
      { icon: <EmailOutlinedIcon />, label: 'Email', value: 'hello@acmecricket.example' },
    ],
    editTo: '/manage/sponsors/s-1/edit',
    editLabel: 'Edit sponsor',
  },
}

export const WithLogoImage: Story = {
  args: {
    ...SponsorQuickView.args,
    avatar: { imageUrl: 'https://placehold.co/96x96', fallback: 'AC', shape: 'rounded' },
  },
}

export const MobileViewport: Story = {
  args: ContactQuickView.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: ContactQuickView.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: ContactQuickView.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
