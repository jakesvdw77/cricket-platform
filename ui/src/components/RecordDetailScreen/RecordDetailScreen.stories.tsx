import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box, Chip } from '@mui/material'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import WcOutlinedIcon from '@mui/icons-material/WcOutlined'
import { RecordDetailScreen, DetailFieldRow, DetailFieldGrid } from './RecordDetailScreen'
import { RecordCard } from '../RecordCard'

// No local MemoryRouter decorator here — .storybook/preview.tsx already wraps every story in one
// globally, same precedent as RecordCard.stories.tsx/RecordFormScreen.stories.tsx.
const meta: Meta<typeof RecordDetailScreen> = {
  title: 'Components/RecordDetailScreen',
  component: RecordDetailScreen,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof RecordDetailScreen>

// Player-shaped: multiple headed sections, each a DetailFieldGrid of icon-prefixed rows.
export const MultiSection: Story = {
  args: {
    title: 'Jane Smith',
    backTo: '/manage/players',
    backLabel: 'Back to Players',
    avatar: { fallback: 'JA', shape: 'circular' },
    badge: { label: 'Active', tone: 'positive' },
    editTo: '/manage/players/p-1/edit',
    sections: [
      {
        heading: 'Basic Info',
        content: (
          <DetailFieldGrid>
            <DetailFieldRow icon={<CalendarTodayOutlinedIcon />} label="Date of birth" value="2001-04-12" />
            <DetailFieldRow icon={<WcOutlinedIcon />} label="Gender" value="Female" />
          </DetailFieldGrid>
        ),
      },
      {
        heading: 'Contact Info',
        content: (
          <DetailFieldGrid>
            <DetailFieldRow icon={<PhoneOutlinedIcon />} label="Phone" value="+27 82 555 0101" />
            <DetailFieldRow icon={<EmailOutlinedIcon />} label="Email" value="jane.smith@example.com" />
          </DetailFieldGrid>
        ),
      },
    ],
  },
}

// Sponsor-shaped: one un-headed section whose content is a bespoke bordered/tinted card, not a
// plain field grid — docs/plans/036's Sponsor decision.
export const SingleCustomCardSection: Story = {
  args: {
    title: 'Acme Cricket Gear',
    backTo: '/manage/sponsors',
    backLabel: 'Back to Sponsors',
    avatar: { fallback: 'AC', shape: 'rounded' },
    badge: { label: 'Active', tone: 'positive' },
    editTo: '/manage/sponsors/s-1/edit',
    sections: [
      {
        content: (
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover', p: 3 }}>
            <DetailFieldGrid>
              <DetailFieldRow icon={<PhoneOutlinedIcon />} label="Phone" value="+27 21 555 0199" />
              <DetailFieldRow icon={<EmailOutlinedIcon />} label="Email" value="hello@acmecricket.example" />
              <DetailFieldRow icon={<LanguageOutlinedIcon />} label="Website" value="acmecricket.example" />
            </DetailFieldGrid>
          </Box>
        ),
      },
    ],
  },
}

// Team-shaped: a headed section whose content is a grid of nested, read-only RecordCards (each
// itself a further view-navigation link) plus a `note` stat pill above the grid.
export const SectionWithNestedRecordCards: Story = {
  args: {
    title: '1st XI',
    backTo: '/manage/sections/sec-1/teams',
    backLabel: 'Back to Teams',
    avatar: { fallback: '1S', shape: 'rounded' },
    badge: { label: 'Active', tone: 'positive' },
    editTo: '/manage/sections/sec-1/teams/t-1/edit',
    sections: [
      {
        heading: 'Squad',
        note: <Chip size="small" variant="outlined" label="12 players" />,
        content: (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
            <RecordCard
              title="John Doe"
              avatar={{ fallback: 'JD', shape: 'circular' }}
              editLabel="View"
              viewTo="/manage/players/p-1"
            />
            <RecordCard
              title="Sam Lee"
              avatar={{ fallback: 'SL', shape: 'circular' }}
              editLabel="View"
              viewTo="/manage/players/p-2"
            />
          </Box>
        ),
      },
    ],
  },
}

// docs/specs/037-match-improvements.md item 2: a link-shaped secondary action rendered before the
// Edit button — Match-shaped (multiple headed sections, plus a "Select Team" shortcut).
export const WithSecondaryActions: Story = {
  args: {
    title: '1st XI vs 2nd XI',
    backTo: '/manage/fixtures/matches',
    backLabel: 'Back to Matches',
    avatar: { fallback: 'M', shape: 'rounded' },
    editTo: '/manage/fixtures/matches/m-1/edit',
    secondaryActions: [{ label: 'Select Team', to: '/manage/fixtures/matches/m-1/edit?tab=playing-xi' }],
    sections: [
      {
        heading: 'Details',
        content: (
          <DetailFieldGrid>
            <DetailFieldRow icon={<CalendarTodayOutlinedIcon />} label="Date & time" value="1 Jun 2026, 14:30" />
          </DetailFieldGrid>
        ),
      },
    ],
  },
}

export const MobileViewport: Story = {
  args: MultiSection.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: MultiSection.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: MultiSection.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
