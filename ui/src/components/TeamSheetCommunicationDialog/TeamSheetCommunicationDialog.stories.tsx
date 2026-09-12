import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
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

const squad = [makePlayer('p1', 'John', 'Smith'), makePlayer('p2', 'Amit', 'Patel')]

const printableHomeSide: TeamSheetSide = {
  team: homeTeam,
  teamName: homeTeam.name,
  side: {
    id: 'side-home',
    matchId: 'match-1',
    teamId: 'team-home',
    captainPlayerId: 'p1',
    wicketKeeperPlayerId: 'p2',
    twelfthManPlayerId: null,
    players: [
      { playerProfileId: 'p1', battingOrder: 1, role: 'BATSMAN' },
      { playerProfileId: 'p2', battingOrder: 2, role: 'BATSMAN' },
    ],
  },
  squad,
}

const unannouncedAwaySide: TeamSheetSide = {
  team: awayTeam,
  teamName: awayTeam.name,
  side: { id: 'side-away', matchId: 'match-1', teamId: 'team-away', captainPlayerId: null, wicketKeeperPlayerId: null, twelfthManPlayerId: null, players: [] },
  squad: [],
}

const meta: Meta<typeof TeamSheetCommunicationDialog> = {
  title: 'Components/TeamSheetCommunicationDialog',
  component: TeamSheetCommunicationDialog,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof TeamSheetCommunicationDialog>

// Both sides have a built XI — every scope option enabled.
export const Default: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    match,
    sides: [printableHomeSide, { ...printableHomeSide, team: awayTeam, teamName: awayTeam.name }],
    sidesLoading: false,
    onPrint: async () => undefined,
  },
}

// The away side has no players added yet — its individual scope option is disabled, but "Both
// Teams" stays available (it'll print a placeholder for the away side).
export const OneSideNotPrintable: Story = {
  args: {
    ...Default.args,
    sides: [printableHomeSide, unannouncedAwaySide],
  },
}

// Neither side has anything printable — the scope toggle is replaced by an inline message and
// Print is disabled entirely.
export const NeitherSidePrintable: Story = {
  args: {
    ...Default.args,
    sides: [unannouncedAwaySide, { ...unannouncedAwaySide, team: awayTeam, teamName: awayTeam.name }],
  },
}

export const Loading: Story = {
  args: {
    ...Default.args,
    sides: [],
    sidesLoading: true,
  },
}

// A rejected onPrint surfaces an inline error and keeps the dialog open for retry — the play
// function clicks Print to actually exercise that failure path, since the error is local state
// only reachable via that interaction, not a settable prop.
export const ErrorState: Story = {
  args: {
    ...Default.args,
    onPrint: async () => {
      throw new Error("Couldn't generate the team sheet. Please try again.")
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: /print both teams/i }))
    await canvas.findByText("Couldn't generate the team sheet. Please try again.")
  },
}

export const MobileViewport: Story = {
  args: OneSideNotPrintable.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: OneSideNotPrintable.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: OneSideNotPrintable.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
