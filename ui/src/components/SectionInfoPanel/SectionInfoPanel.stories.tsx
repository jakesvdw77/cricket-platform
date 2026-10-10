import type { Meta, StoryObj } from '@storybook/react-vite'
import { SectionInfoPanel } from './SectionInfoPanel'
import type { Section, SectionSummary } from '../../api/sectionApi'
import type { Team } from '../../api/teamApi'
import type { ClubContact } from '../../api/clubContactApi'

function makeSection(overrides: Partial<Section>): Section {
  return {
    id: 's',
    clubId: 'club-1',
    parentSectionId: null,
    name: 'Section',
    minAge: null,
    maxAge: null,
    gender: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

const JUNIORS = makeSection({ id: 'juniors', name: 'Juniors' })
const BOYS = makeSection({ id: 'boys', name: 'Boys', parentSectionId: 'juniors', minAge: 6, maxAge: 9, gender: 'MALE' })
const SECTIONS = [
  JUNIORS,
  BOYS,
  makeSection({ id: 'u9', name: 'U9', parentSectionId: 'boys', maxAge: 9 }),
  makeSection({ id: 'u11', name: 'U11', parentSectionId: 'boys', active: false }),
]

const SUMMARY: SectionSummary = {
  sectionId: 'boys',
  teamCount: 2,
  activeTeamCount: 2,
  playerCount: 14,
  subtreeTeamCount: 5,
  subtreePlayerCount: 31,
  leagues: [{ id: 'l1', name: 'Saturday Junior League' }],
}

function makeTeam(id: string, name: string, active = true): Team {
  return {
    id, clubId: 'club-1', sectionId: 'boys', name, logoUrl: null, abbreviation: null, groundName: null,
    socialLinks: [], active, createdAt: '', updatedAt: '', updatedBy: null,
  }
}

const CONTACT: ClubContact = {
  id: 'c1', clubId: 'club-1', contact: { firstName: 'Ada', lastName: 'Lovelace', email: 'a@x.test', phone: '1' },
  role: 'Coach', isPrimary: false, active: true, photoUrl: null, createdAt: '', updatedAt: '', updatedBy: null,
}

const meta: Meta<typeof SectionInfoPanel> = {
  title: 'Components/SectionInfoPanel',
  component: SectionInfoPanel,
  parameters: { layout: 'padded' },
  args: {
    section: BOYS,
    sections: SECTIONS,
    summary: SUMMARY,
    seasonLabel: '2026/27',
    teams: [makeTeam('t1', 'Boys 1st'), makeTeam('t2', 'Boys 2nd', false)],
    contacts: [CONTACT],
    onClose: () => {},
    onSelectSection: () => {},
    onRetry: () => {},
    editTo: '/manage/sections?sectionId=boys',
    manageTeamsTo: '/manage/sections/boys/teams',
    teamTo: (team) => `/manage/sections/boys/teams/${team.id}`,
    leagueTo: (league) => `/manage/leagues/${league.id}`,
  },
}
export default meta

type Story = StoryObj<typeof SectionInfoPanel>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    section: JUNIORS,
    sections: [JUNIORS],
    summary: { ...SUMMARY, sectionId: 'juniors', teamCount: 0, subtreeTeamCount: 0, playerCount: 0, subtreePlayerCount: 0, leagues: [] },
    teams: [],
    contacts: [],
  },
}

export const Inactive: Story = { args: { section: { ...BOYS, active: false } } }

export const Loading: Story = { args: { summary: undefined, teamsLoading: true, contactsLoading: true } }

export const ErrorState: Story = { args: { summary: undefined, error: true } }
