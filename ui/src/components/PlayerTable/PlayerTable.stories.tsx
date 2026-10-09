import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlayerTable } from './PlayerTable'
import type { Player } from '../../api/playerApi'

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    personId: 'person-1',
    clubId: 'club-1',
    firstName: 'Sipho',
    lastName: 'Ndlovu',
    dateOfBirth: '2010-04-12',
    gender: 'MALE',
    photoUrl: null,
    clubMembershipNumber: 'RCC-042',
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
    sectionIds: [],
    jerseyNumber: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    verificationStatus: 'VERIFIED',
    gamesThisSeason: 0,
    gamesOverall: 0,
    ...overrides,
  }
}


const meta: Meta<typeof PlayerTable> = {
  title: 'Components/PlayerTable',
  component: PlayerTable,
  parameters: { layout: 'padded' },
  args: {
    sectionNamesFor: (player) => (player.sectionIds.length > 0 ? ['Vets'] : []),
    viewTo: (player) => `/manage/players/${player.id}`,
    onStatusAction: () => undefined,
  },
}
export default meta

type Story = StoryObj<typeof PlayerTable>

const full = { jerseyNumber: 7, phone: '083 555 0177', battingStance: 'LEFT_HANDED' as const, bowlingArm: 'RIGHT_ARM' as const, bowlingType: 'MEDIUM' as const, sectionIds: ['s1'] }

// docs/specs/088 (F): every status, equal rows, zebra tint, the same Status menu per row.
export const AllStatuses: Story = {
  args: {
    players: [
      makePlayer({ id: '1', firstName: 'Amy', lastName: 'Ansell', gamesThisSeason: 10, gamesOverall: 64, ...full }),
      makePlayer({ id: '2', firstName: 'Casey', lastName: 'Naidoo', verificationStatus: 'UNVERIFIED', gamesThisSeason: 12, gamesOverall: 48, ...full }),
      makePlayer({ id: '3', firstName: 'Lerato', lastName: 'Dlamini', verificationStatus: 'REJECTED', gamesOverall: 3, phone: '072 555 0188' }),
      makePlayer({ id: '4', firstName: 'Pieter', lastName: 'Botha', active: false, gamesThisSeason: 2, gamesOverall: 76, ...full }),
      makePlayer({ id: '5', firstName: 'Zed', lastName: 'Zulu', gamesThisSeason: 8, gamesOverall: 52, ...full }),
    ],
  },
}

// Nothing on file: the cells show "–" and the rows keep their height.
export const NothingOnFile: Story = {
  args: { players: [makePlayer({ id: '1', firstName: 'Sam', lastName: 'Peters', dateOfBirth: null }), makePlayer({ id: '2', firstName: 'Aisha', lastName: 'Patel' })] },
}

export const LongName: Story = {
  args: { players: [makePlayer({ id: '1', firstName: 'Christopher Alexander', lastName: 'Montgomery-Hendricks the Third', gamesThisSeason: 14, gamesOverall: 1203, ...full })] },
}

// A phone keeps Player (the badge under the name), the two games columns and the Status button.
export const Mobile: Story = {
  ...AllStatuses,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}
