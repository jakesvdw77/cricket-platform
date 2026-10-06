import api from './axiosConfig'

// docs/specs/079-manager-shell-and-overview.md: the club-manager overview, one read-only call.
export interface OverviewOwnSide {
  teamId: string
  teamName: string
  selectedCount: number
  maxSelected: number | null
  announced: boolean
}

export interface OverviewMatch {
  matchId: string
  matchDate: string
  venue: string | null
  homeTeamId: string | null
  homeTeamName: string
  awayTeamId: string | null
  awayTeamName: string
  sectionId: string | null
  // Home first; empty for a pure opposition fixture.
  ownSides: OverviewOwnSide[]
}

export interface OverviewPoll {
  kind: 'SQUAD' | 'GROUP'
  id: string
  // null for a GROUP poll.
  matchId: string | null
  title: string
  repliedCount: number
  totalCount: number
  scheduledCloseAt: string | null
}

export interface OverviewResult {
  matchId: string
  summary: string
}

export interface OverviewQuickActions {
  createMatch: boolean
  createPoll: boolean
  addPlayer: boolean
  messageSquad: boolean
}

export interface ManagerOverview {
  matchesThisWeek: number
  teamsNotAnnounced: number
  pollAnswersAwaited: number
  activePlayers: number
  upcomingMatches: OverviewMatch[]
  openPolls: OverviewPoll[]
  recentResults: OverviewResult[]
  quickActions: OverviewQuickActions
}

export async function getManagerOverview(clubId: string): Promise<ManagerOverview> {
  const { data } = await api.get<ManagerOverview>(`/manage/clubs/${clubId}/overview`)
  return data
}
