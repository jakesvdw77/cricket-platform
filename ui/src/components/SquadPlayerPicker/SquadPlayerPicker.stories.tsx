import type { Meta, StoryObj } from '@storybook/react-vite'
import { SquadPlayerPicker } from './SquadPlayerPicker'
import type { Player } from '../../api/playerApi'
import type { Section } from '../../api/sectionApi'

const base = {
  personId: 'person',
  clubId: 'club-1',
  gender: null,
  photoUrl: null,
  clubMembershipNumber: null,
  medicalAidProvider: null,
  medicalAidMemberNumber: null,
  phone: null,
  email: null,
  altContactName: null,
  altContactPhone: null,
  battingStance: null,
  bowlingArm: null,
  bowlingType: null,
  isWicketKeeper: false,
  active: true,
  jerseyNumber: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: null,
  verificationStatus: 'VERIFIED',
  gamesThisSeason: 0,
  gamesOverall: 0,
} as const

const sections: Section[] = [
  { id: 'men', clubId: 'club-1', parentSectionId: null, name: 'Men', minAge: null, maxAge: null, gender: null, active: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: null },
  { id: 'u15', clubId: 'club-1', parentSectionId: null, name: 'U15', minAge: null, maxAge: 15, gender: null, active: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: null },
]

const candidates: Player[] = [
  { ...base, id: 'p1', firstName: 'Bob', lastName: 'Jones', dateOfBirth: '1990-03-02', sectionIds: ['men'] },
  { ...base, id: 'p2', firstName: 'Bob', lastName: 'Jones', dateOfBirth: '2011-09-14', sectionIds: ['u15'] },
  { ...base, id: 'p3', firstName: 'Amy', lastName: 'Adams', dateOfBirth: null, sectionIds: ['men', 'u15'] },
]

const meta: Meta<typeof SquadPlayerPicker> = {
  title: 'Components/SquadPlayerPicker',
  component: SquadPlayerPicker,
  args: { open: true, onClose: () => undefined, onAdd: () => undefined, candidates, sections, defaultSectionId: 'men' },
}
export default meta

type Story = StoryObj<typeof SquadPlayerPicker>

export const Default: Story = {}

export const AllSections: Story = { args: { defaultSectionId: '' } }

export const Empty: Story = { args: { candidates: [] } }

export const Loading: Story = { args: { loading: true } }

export const WithError: Story = { args: { error: "Couldn't add these players. Please try again." } }
