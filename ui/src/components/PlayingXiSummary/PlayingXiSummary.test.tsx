import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlayingXiSummary } from './PlayingXiSummary'
import type { SquadMember } from '../../api/teamSquadApi'

function squadMember(overrides: Partial<SquadMember> & { playerProfileId: string }): SquadMember {
  return {
    id: `squad-${overrides.playerProfileId}`,
    personId: `person-${overrides.playerProfileId}`,
    clubId: 'club-1',
    firstName: 'First',
    lastName: 'Last',
    dateOfBirth: null,
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
    sectionIds: [],
    jerseyNumber: null,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    squadJerseyNumber: null,
    isCaptain: false,
    ...overrides,
  }
}

describe('PlayingXiSummary', () => {
  it('renders an ordered XI with captain/wicketkeeper badges and role chips', () => {
    const squad = [
      squadMember({ playerProfileId: 'p-1', firstName: 'Jane', lastName: 'Smith' }),
      squadMember({ playerProfileId: 'p-2', firstName: 'Sam', lastName: 'Lee' }),
      squadMember({ playerProfileId: 'p-3', firstName: 'Alex', lastName: 'Jones' }),
    ]

    render(
      <PlayingXiSummary
        squad={squad}
        xi={[
          { playerProfileId: 'p-2', battingOrder: 2, role: 'BOWLER' },
          { playerProfileId: 'p-1', battingOrder: 1, role: 'BATSMAN' },
        ]}
        captainPlayerId="p-1"
        wicketKeeperPlayerId="p-2"
        twelfthManPlayerId="p-3"
      />,
    )

    const names = screen.getAllByText(/Jane Smith|Sam Lee/).map((node) => node.textContent)
    expect(names.indexOf('Jane Smith')).toBeLessThan(names.indexOf('Sam Lee'))

    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('WK')).toBeInTheDocument()
    expect(screen.getByText('Batsman')).toBeInTheDocument()
    expect(screen.getByText('Bowler')).toBeInTheDocument()

    expect(screen.getByText('12th')).toBeInTheDocument()
    expect(screen.getByText('Alex Jones')).toBeInTheDocument()
  })

  it('renders the empty state when the side has no MatchSide (no xi, no twelfth man)', () => {
    render(
      <PlayingXiSummary squad={[]} xi={[]} captainPlayerId={null} wicketKeeperPlayerId={null} twelfthManPlayerId={null} />,
    )

    expect(screen.getByText('No XI selected yet')).toBeInTheDocument()
  })
})
