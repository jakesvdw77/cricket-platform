import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TeamSheetCommunicationDialog } from './TeamSheetCommunicationDialog'
import type { TeamSheetSide } from '../../utils/teamSheetPdf'
import type { Match } from '../../api/matchApi'
import type { Team } from '../../api/teamApi'
import type { Player } from '../../api/playerApi'

const match: Match = {
  id: 'match-1',
  clubId: 'club-1',
  homeTeamId: 'team-home',
  homeTeamName: null,
  awayTeamId: 'team-away',
  awayTeamName: null,
  leagueId: null,
  seasonId: 'season-1',
  matchDate: '2026-03-01T10:00:00Z',
  venue: 'Riverside Oval',
  active: true,
  createdAt: '',
  updatedAt: '',
  updatedBy: null,
}

const freeTextMatch: Match = { ...match, homeTeamId: null, homeTeamName: 'Visiting XI' }

const homeTeam: Team = {
  id: 'team-home',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Riverside 1st XI',
  logoUrl: null,
  active: true,
  createdAt: '',
  updatedAt: '',
  updatedBy: null,
}

const awayTeam: Team = {
  id: 'team-away',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Coastal CC',
  logoUrl: null,
  active: true,
  createdAt: '',
  updatedAt: '',
  updatedBy: null,
}

function makePlayer(id: string, firstName: string, lastName: string): Player {
  return {
    id,
    personId: id,
    clubId: 'club-1',
    firstName,
    lastName,
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
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
  }
}

const squad = [makePlayer('p1', 'John', 'Smith')]

function printableSide(team: Team): TeamSheetSide {
  return {
    team,
    teamName: team.name,
    side: {
      id: `side-${team.id}`,
      matchId: 'match-1',
      teamId: team.id,
      captainPlayerId: 'p1',
      wicketKeeperPlayerId: null,
      twelfthManPlayerId: null,
      players: [{ playerProfileId: 'p1', battingOrder: 1, role: 'BATSMAN' }],
    },
    squad,
  }
}

function unannouncedSide(team: Team): TeamSheetSide {
  return {
    team,
    teamName: team.name,
    side: { id: `side-${team.id}`, matchId: 'match-1', teamId: team.id, captainPlayerId: null, wicketKeeperPlayerId: null, twelfthManPlayerId: null, players: [] },
    squad: [],
  }
}

describe('TeamSheetCommunicationDialog', () => {
  it('enables the Both Teams scope and both individual scopes when both sides are printable', () => {
    render(
      <TeamSheetCommunicationDialog
        open
        onClose={vi.fn()}
        match={match}
        sides={[printableSide(homeTeam), printableSide(awayTeam)]}
        sidesLoading={false}
        onPrint={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByRole('button', { name: 'Both Teams' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Riverside 1st XI' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Coastal CC' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Print Both Teams' })).not.toBeDisabled()
  })

  it('disables an individual scope for a side with zero players, but keeps Both Teams enabled', () => {
    render(
      <TeamSheetCommunicationDialog
        open
        onClose={vi.fn()}
        match={match}
        sides={[printableSide(homeTeam), unannouncedSide(awayTeam)]}
        sidesLoading={false}
        onPrint={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByRole('button', { name: 'Both Teams' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Riverside 1st XI' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Coastal CC' })).toBeDisabled()
  })

  it('disables an individual scope for a free-text opponent with no real Team', () => {
    render(
      <TeamSheetCommunicationDialog
        open
        onClose={vi.fn()}
        match={freeTextMatch}
        sides={[unannouncedSide({ ...homeTeam, name: 'Visiting XI' }), printableSide(awayTeam)]}
        sidesLoading={false}
        onPrint={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByRole('button', { name: 'Visiting XI' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Coastal CC' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Both Teams' })).not.toBeDisabled()
  })

  it('replaces the scope toggle with an inline message and disables Print when neither side is printable', () => {
    render(
      <TeamSheetCommunicationDialog
        open
        onClose={vi.fn()}
        match={match}
        sides={[unannouncedSide(homeTeam), unannouncedSide(awayTeam)]}
        sidesLoading={false}
        onPrint={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(
      screen.getByText("Add players to at least one side's Playing XI before printing a team sheet."),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Both Teams' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled()
  })

  it('calls onPrint with the selected scope and closes the dialog on success', async () => {
    const user = userEvent.setup()
    const onPrint = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <TeamSheetCommunicationDialog
        open
        onClose={onClose}
        match={match}
        sides={[printableSide(homeTeam), printableSide(awayTeam)]}
        sidesLoading={false}
        onPrint={onPrint}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Coastal CC' }))
    await user.click(screen.getByRole('button', { name: /print coastal cc/i }))

    expect(onPrint).toHaveBeenCalledWith('away')
    await screen.findByText('Coastal CC') // dialog content still resolvable while awaiting close
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows an inline error and keeps the dialog open when onPrint rejects', async () => {
    const user = userEvent.setup()
    const onPrint = vi.fn().mockRejectedValue(new Error('PDF generation failed'))
    const onClose = vi.fn()
    render(
      <TeamSheetCommunicationDialog
        open
        onClose={onClose}
        match={match}
        sides={[printableSide(homeTeam), printableSide(awayTeam)]}
        sidesLoading={false}
        onPrint={onPrint}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Print Both Teams' }))

    expect(await screen.findByText('PDF generation failed')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('disables Print while sidesLoading is true', () => {
    render(
      <TeamSheetCommunicationDialog
        open
        onClose={vi.fn()}
        match={match}
        sides={[unannouncedSide(homeTeam), unannouncedSide(awayTeam)]}
        sidesLoading
        onPrint={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled()
    expect(screen.getByText('Loading team sheets…')).toBeInTheDocument()
  })
})
