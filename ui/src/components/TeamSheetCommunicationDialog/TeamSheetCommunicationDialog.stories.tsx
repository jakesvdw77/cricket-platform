import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
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
  homeSideAnnounced: false,
  awaySideAnnounced: false,
  homeTeamLogoUrl: null,
  awayTeamLogoUrl: null,
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

const squad = [makeSquadMember('p1', 'John', 'Smith'), makeSquadMember('p2', 'Amit', 'Patel')]

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
    announced: false,
  },
  squad,
}

const unannouncedAwaySide: TeamSheetSide = {
  team: awayTeam,
  teamName: awayTeam.name,
  side: { id: 'side-away', matchId: 'match-1', teamId: 'team-away', captainPlayerId: null, wicketKeeperPlayerId: null, twelfthManPlayerId: null, players: [], announced: false },
  squad: [],
}

const meta: Meta<typeof TeamSheetCommunicationDialog> = {
  title: 'Components/TeamSheetCommunicationDialog',
  component: TeamSheetCommunicationDialog,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof TeamSheetCommunicationDialog>

// The same already-assembled date/venue/league-season string MatchCard computes via
// matchFields() — reused verbatim by both the PDF and WhatsApp paths (docs/specs/039).
const subtitle = '1 March 2026 · Riverside Oval · Premier League — 2026'

// Both sides have a built XI — every scope option enabled.
export const Default: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    match,
    sides: [printableHomeSide, { ...printableHomeSide, team: awayTeam, teamName: awayTeam.name }],
    sidesLoading: false,
    onPrint: async () => undefined,
    subtitle,
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

// Selecting "WhatsApp" reveals the generated, editable text area in place of the (nonexistent, for
// PDF) preview area — the play function clicks the WhatsApp row, same pattern ErrorState already
// uses to exercise a state only reachable via interaction, not a settable prop.
export const WhatsAppSelected: Story = {
  args: Default.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: /whatsapp/i }))
    await canvas.findByRole('textbox', { name: /whatsapp message/i })
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

// The PDF-path viewport trio above never exercises the WhatsApp option's own Input/Regenerate
// row — these three mirror WhatsAppSelected's own args/play so the WhatsApp state gets the same
// mobile/tablet/desktop coverage the PDF path already has.
export const WhatsAppMobileViewport: Story = {
  args: WhatsAppSelected.args,
  play: WhatsAppSelected.play,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const WhatsAppTabletViewport: Story = {
  args: WhatsAppSelected.args,
  play: WhatsAppSelected.play,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const WhatsAppDesktopViewport: Story = {
  args: WhatsAppSelected.args,
  play: WhatsAppSelected.play,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
