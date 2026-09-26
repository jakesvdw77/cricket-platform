import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PlayerCard } from './PlayerCard'
import type { Player } from '../../api/playerApi'
import { BATTING_STANCE_LABEL, BOWLING_ARM_LABEL, BOWLING_TYPE_LABEL } from '../../utils/playerLabels'

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    personId: 'person-1',
    clubId: 'test-club-id',
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
    ...overrides,
  }
}

function renderCard(props: Partial<Parameters<typeof PlayerCard>[0]> = {}) {
  return render(
    <MemoryRouter>
      <PlayerCard
        player={makePlayer()}
        sectionNames={[]}
        viewTo="/manage/players/player-1"
        editTo="/manage/players/player-1/edit"
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('PlayerCard', () => {
  it('renders the title as a link to viewTo and Edit as a link to editTo, with no separate View link', () => {
    renderCard({
      player: makePlayer({ firstName: 'Sipho', lastName: 'Ndlovu' }),
      viewTo: '/manage/players/player-1',
      editTo: '/manage/players/player-1/edit',
    })

    expect(screen.getByRole('heading', { name: 'Sipho Ndlovu' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sipho Ndlovu' })).toHaveAttribute('href', '/manage/players/player-1')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/players/player-1/edit')
    expect(screen.queryByRole('link', { name: 'View' })).not.toBeInTheDocument()
  })

  it('renders a jersey-number chip when jerseyNumber is set', () => {
    renderCard({ player: makePlayer({ jerseyNumber: 7 }) })
    expect(screen.getByText('#7')).toBeInTheDocument()
  })

  it('renders no jersey-number chip when jerseyNumber is null', () => {
    renderCard({ player: makePlayer({ jerseyNumber: null }) })
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument()
  })

  it('renders the first tagged section name only, with no overflow chip, when tagged to one section', () => {
    renderCard({ sectionNames: ['Colts A'] })

    expect(screen.getByText('Colts A')).toBeInTheDocument()
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument()
  })

  it('renders the first section name plus a +N overflow chip when tagged to more than one section', () => {
    renderCard({ sectionNames: ['Colts A', 'Colts B'] })

    expect(screen.getByText('Colts A')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(screen.queryByText('Colts B')).not.toBeInTheDocument()
  })

  it('renders no section chip and no overflow chip when the player has no tagged sections', () => {
    renderCard({ sectionNames: [] })

    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument()
  })

  it('renders the badge alongside a section chip when both are passed', () => {
    renderCard({ sectionNames: ['Colts A'], badge: { label: 'Inactive', tone: 'muted' } })

    expect(screen.getByText('Colts A')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('renders just the badge, with no section chip, when there are no tagged sections', () => {
    renderCard({ sectionNames: [], badge: { label: 'Inactive', tone: 'muted' } })

    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('renders a phone row only when the player has a phone number', () => {
    renderCard({ player: makePlayer({ phone: '082 555 1234' }) })
    expect(screen.getByText('082 555 1234')).toBeInTheDocument()
  })

  it('renders no phone row when the player has no phone number', () => {
    renderCard({ player: makePlayer({ phone: null }) })
    expect(screen.queryByText('082 555 1234')).not.toBeInTheDocument()
  })

  it('renders the batting row with the correct label only when battingStance is set', () => {
    renderCard({ player: makePlayer({ battingStance: 'RIGHT_HANDED' }) })
    expect(screen.getByText(`Bat: ${BATTING_STANCE_LABEL.RIGHT_HANDED}`)).toBeInTheDocument()
  })

  it('renders no batting row when battingStance is not set', () => {
    renderCard({ player: makePlayer({ battingStance: null }) })
    expect(screen.queryByText(/^Bat:/)).not.toBeInTheDocument()
  })

  it('renders a partial bowling row (arm only) when only bowlingArm is set', () => {
    renderCard({ player: makePlayer({ bowlingArm: 'RIGHT_ARM', bowlingType: null }) })
    expect(screen.getByText(`Bowl: ${BOWLING_ARM_LABEL.RIGHT_ARM}`)).toBeInTheDocument()
  })

  it('renders a partial bowling row (type only) when only bowlingType is set', () => {
    renderCard({ player: makePlayer({ bowlingArm: null, bowlingType: 'OFF_BREAK' }) })
    expect(screen.getByText(`Bowl: ${BOWLING_TYPE_LABEL.OFF_BREAK}`)).toBeInTheDocument()
  })

  it('renders a comma-joined bowling row when both bowlingArm and bowlingType are set', () => {
    renderCard({ player: makePlayer({ bowlingArm: 'RIGHT_ARM', bowlingType: 'OFF_BREAK' }) })
    expect(
      screen.getByText(`Bowl: ${BOWLING_ARM_LABEL.RIGHT_ARM}, ${BOWLING_TYPE_LABEL.OFF_BREAK}`),
    ).toBeInTheDocument()
  })

  it('renders no bowling row when neither bowlingArm nor bowlingType is set', () => {
    renderCard({ player: makePlayer({ bowlingArm: null, bowlingType: null }) })
    expect(screen.queryByText(/^Bowl:/)).not.toBeInTheDocument()
  })

  it('renders a clean card with just the name, avatar, and Edit link for a sparse player', () => {
    renderCard({
      player: makePlayer({
        jerseyNumber: null,
        phone: null,
        battingStance: null,
        bowlingArm: null,
        bowlingType: null,
      }),
      sectionNames: [],
      badge: undefined,
    })

    expect(screen.getByRole('heading', { name: 'Sipho Ndlovu' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Bat:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Bowl:/)).not.toBeInTheDocument()
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument()
  })
})
