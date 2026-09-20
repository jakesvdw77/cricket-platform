import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TeamSheetCommunicationDialog } from './TeamSheetCommunicationDialog'
import type { TeamSheetSide } from '../../utils/teamSheetPdf'
import type { Match } from '../../api/matchApi'
import type { Team } from '../../api/teamApi'
import type { SquadMember } from '../../api/teamSquadApi'

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

function makeSquadMember(playerProfileId: string, firstName: string, lastName: string): SquadMember {
  return {
    id: `squad-row-${playerProfileId}`,
    playerProfileId,
    personId: playerProfileId,
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
    jerseyNumber: null,
    squadJerseyNumber: null,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
  }
}

const squad = [makeSquadMember('p1', 'John', 'Smith')]

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
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
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
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
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
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
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
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
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
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
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
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
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
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
      />,
    )

    expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled()
    expect(screen.getByText('Loading team sheets…')).toBeInTheDocument()
  })

  it('selecting WhatsApp reveals a textbox pre-filled with a role emoji (docs/specs/039)', async () => {
    const user = userEvent.setup()
    render(
      <TeamSheetCommunicationDialog
        open
        onClose={vi.fn()}
        match={match}
        sides={[printableSide(homeTeam), printableSide(awayTeam)]}
        sidesLoading={false}
        onPrint={vi.fn().mockResolvedValue(undefined)}
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
      />,
    )

    await user.click(screen.getByRole('button', { name: /whatsapp/i }))

    const textbox = await screen.findByRole('textbox', { name: /whatsapp message/i })
    expect((textbox as HTMLTextAreaElement).value).toContain('🏏')
  })

  it('regenerates the WhatsApp textbox when the team-scope selection changes (docs/specs/039)', async () => {
    const user = userEvent.setup()
    render(
      <TeamSheetCommunicationDialog
        open
        onClose={vi.fn()}
        match={match}
        sides={[printableSide(homeTeam), printableSide(awayTeam)]}
        sidesLoading={false}
        onPrint={vi.fn().mockResolvedValue(undefined)}
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
      />,
    )

    await user.click(screen.getByRole('button', { name: /whatsapp/i }))
    await user.click(screen.getByRole('button', { name: 'Riverside 1st XI' }))

    const textbox = await screen.findByRole('textbox', { name: /whatsapp message/i })
    expect((textbox as HTMLTextAreaElement).value).toContain('Riverside 1st XI')
    expect((textbox as HTMLTextAreaElement).value).not.toContain('Coastal CC')

    await user.click(screen.getByRole('button', { name: 'Coastal CC' }))

    expect((textbox as HTMLTextAreaElement).value).toContain('Coastal CC')
    expect((textbox as HTMLTextAreaElement).value).not.toContain('Riverside 1st XI')
  })

  it('discards a manual edit and rebuilds from current data when Regenerate is clicked (docs/specs/039)', async () => {
    const user = userEvent.setup()
    render(
      <TeamSheetCommunicationDialog
        open
        onClose={vi.fn()}
        match={match}
        sides={[printableSide(homeTeam), printableSide(awayTeam)]}
        sidesLoading={false}
        onPrint={vi.fn().mockResolvedValue(undefined)}
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
      />,
    )

    await user.click(screen.getByRole('button', { name: /whatsapp/i }))
    const textbox = await screen.findByRole('textbox', { name: /whatsapp message/i })
    const originalValue = (textbox as HTMLTextAreaElement).value

    await user.clear(textbox)
    await user.type(textbox, 'a manually added note')
    expect((textbox as HTMLTextAreaElement).value).toBe('a manually added note')

    await user.click(screen.getByRole('button', { name: /regenerate/i }))

    expect((textbox as HTMLTextAreaElement).value).toBe(originalValue)
    expect((textbox as HTMLTextAreaElement).value).not.toContain('a manually added note')
  })

  it('applies the same scope-disable rules under WhatsApp as under Print as PDF (docs/specs/039)', async () => {
    const user = userEvent.setup()
    render(
      <TeamSheetCommunicationDialog
        open
        onClose={vi.fn()}
        match={freeTextMatch}
        sides={[unannouncedSide({ ...homeTeam, name: 'Visiting XI' }), printableSide(awayTeam)]}
        sidesLoading={false}
        onPrint={vi.fn().mockResolvedValue(undefined)}
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
      />,
    )

    await user.click(screen.getByRole('button', { name: /whatsapp/i }))

    expect(screen.getByRole('button', { name: 'Visiting XI' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Coastal CC' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Both Teams' })).not.toBeDisabled()
  })

  it('leaves Facebook unselectable, whichever option is currently selected (docs/specs/039)', () => {
    render(
      <TeamSheetCommunicationDialog
        open
        onClose={vi.fn()}
        match={match}
        sides={[printableSide(homeTeam), printableSide(awayTeam)]}
        sidesLoading={false}
        onPrint={vi.fn().mockResolvedValue(undefined)}
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
      />,
    )

    expect(screen.queryByRole('button', { name: /facebook/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('listitembutton', { name: /facebook/i })).not.toBeInTheDocument()
    expect(screen.getByText('Facebook')).toBeInTheDocument()
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
  })

  it('"Copy to Clipboard" under WhatsApp writes the textbox content to the clipboard and closes, without calling onPrint (docs/specs/039)', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
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
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
      />,
    )

    await user.click(screen.getByRole('button', { name: /whatsapp/i }))
    const textbox = await screen.findByRole('textbox', { name: /whatsapp message/i })
    const generatedText = (textbox as HTMLTextAreaElement).value

    await user.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    expect(writeText).toHaveBeenCalledWith(generatedText)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPrint).not.toHaveBeenCalled()
  })

  it('shows an inline error and keeps the dialog open when the clipboard write rejects (docs/specs/039)', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })
    const onClose = vi.fn()
    render(
      <TeamSheetCommunicationDialog
        open
        onClose={onClose}
        match={match}
        sides={[printableSide(homeTeam), printableSide(awayTeam)]}
        sidesLoading={false}
        onPrint={vi.fn().mockResolvedValue(undefined)}
        subtitle="1 March 2026 · Riverside Oval · Premier League — 2026"
      />,
    )

    await user.click(screen.getByRole('button', { name: /whatsapp/i }))
    await user.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    expect(await screen.findByText("Couldn't copy to clipboard. Please try again.")).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
