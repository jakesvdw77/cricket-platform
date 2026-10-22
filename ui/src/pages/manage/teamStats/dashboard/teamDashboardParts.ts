import type { TeamDashboard, TeamDashboardResult } from '../../../../api/teamDashboardApi'

export interface TeamCardProps {
  data: TeamDashboard
  // the team page address with the filters in force: the result page's Back returns here
  backTo: string
  dimmed: boolean
}

// "W", "W forfeit", "W internal": the result letter with its text markers, never colour alone.
export function resultMarkers(result: Pick<TeamDashboardResult, 'forfeit' | 'derby'>): string[] {
  return [result.derby ? 'internal' : '', result.forfeit ? 'forfeit' : ''].filter(Boolean)
}
