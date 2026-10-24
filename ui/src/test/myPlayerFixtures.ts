import type { MyPlayer, MyPlayerAgent } from '../api/myPlayersApi'

// docs/specs/119 3C: a fully populated own-record player; a test overrides what it needs.
export function makeMyPlayer(overrides: Partial<MyPlayer> = {}): MyPlayer {
  return {
    key: 'k1',
    firstName: 'Aman',
    lastName: 'Naidoo',
    photoUrl: null,
    clubId: 'c1',
    clubName: 'Riverside CC',
    groupLabel: 'Under 14',
    self: false,
    main: true,
    sectionNames: ['Under 14'],
    teamNames: ['Riverside U14 A'],
    jerseyNumber: 7,
    canEditMedical: true,
    dateOfBirth: '2012-03-04',
    canEditDateOfBirth: true,
    phone: '082 555 0100',
    email: 'aman@example.com',
    altContactName: 'Priya Naidoo',
    altContactPhone: '082 555 0200',
    battingStance: 'RIGHT_HANDED',
    bowlingArm: 'RIGHT_ARM',
    bowlingType: null,
    isWicketKeeper: true,
    medicalAidProvider: 'Discovery',
    medicalAidMemberNumber: 'D-1234',
    agentCount: 1,
    canManageAgents: true,
    myLinkId: 'my-link',
    agents: [],
    ...overrides,
  }
}

export const agent = (overrides: Partial<MyPlayerAgent> = {}): MyPlayerAgent => ({ linkId: 'a1', name: 'Priya Naidoo', maskedEmail: 'p***@example.com', main: true, status: 'ACTIVE', ...overrides })

// A player with nothing filled in beyond the name, to exercise the hidden-field and "Complete this profile" paths.
export const emptyDetails: Partial<MyPlayer> = {
  sectionNames: [],
  teamNames: [],
  jerseyNumber: null,
  dateOfBirth: null,
  phone: null,
  email: null,
  altContactName: null,
  altContactPhone: null,
  battingStance: null,
  bowlingArm: null,
  bowlingType: null,
  isWicketKeeper: false,
  medicalAidProvider: null,
  medicalAidMemberNumber: null,
}
