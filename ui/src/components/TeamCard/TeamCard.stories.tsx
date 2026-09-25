import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { TeamCard } from './TeamCard'
import type { Team } from '../../api/teamApi'
import type { Sponsor } from '../../api/sponsorApi'

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    clubId: 'club-1',
    sectionId: 'section-1',
    name: '1st XI',
    logoUrl: null,
    abbreviation: null,
    groundName: null,
    socialLinks: [],
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

const SPONSORS: Sponsor[] = [
  {
    id: 'sponsor-1',
    clubId: 'club-1',
    name: 'Acme Bank',
    website: 'https://acme.example.com',
    email: null,
    phone: null,
    logoUrl: null,
    bannerUrl: null,
    socialLinks: [],
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
  },
]

const meta: Meta<typeof TeamCard> = {
  title: 'Components/TeamCard',
  component: TeamCard,
  parameters: { layout: 'padded' },
  // No local MemoryRouter decorator here — .storybook/preview.tsx already wraps every story in
  // one globally; adding a second nested <MemoryRouter> throws ("You cannot render a <Router>
  // inside another <Router>"), same precedent RecordCard.stories.tsx already establishes.
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 420 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof TeamCard>

// docs/specs/057-team-extended-profile.md's approved "Detailed" density — every icon row/pill
// populated.
export const Detailed: Story = {
  args: {
    team: makeTeam({
      abbreviation: 'ICL',
      groundName: 'Irene Country Club',
      socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/irene1stxi' }],
    }),
    sectionName: 'Men',
    captainName: 'Jane Smith',
    managerName: 'Bob Jones',
    coachName: 'Alex Lee',
    playerCount: 14,
    matchCount: 8,
    sponsors: SPONSORS,
    viewTo: '/manage/sections/section-1/teams/team-1',
    editTo: '/manage/sections/section-1/teams/team-1/edit',
  },
}

// Every optional field cleanly omitted — no error, no empty icon (the spec's Acceptance Criteria).
export const Minimal: Story = {
  args: {
    team: makeTeam(),
    sectionName: 'Men',
    playerCount: 0,
    matchCount: 0,
    viewTo: '/manage/sections/section-1/teams/team-1',
    editTo: '/manage/sections/section-1/teams/team-1/edit',
  },
}

export const Inactive: Story = {
  args: {
    ...Detailed.args,
    badge: { label: 'Inactive', tone: 'muted' },
  },
}

export const MobileViewport: Story = {
  args: Detailed.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Detailed.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Detailed.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
