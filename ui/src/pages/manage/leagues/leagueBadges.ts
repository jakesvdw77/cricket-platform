import type { RecordCardBadge } from '../../../components/RecordCard'
import { LEAGUE_FORMAT_LABELS } from '../../../api/leagueApi'
import type { League } from '../../../api/leagueApi'

// docs/specs/072-league-view-pages.md section 6: the ordered badges shared by the league view
// header (no season label) and the league card (docs/specs/071-league-card-redesign.md, passes the
// season label): format (when set), team count, season label (only when passed), then Active or
// Inactive.
export function leagueBadges(
  league: League,
  { teamCount, seasonLabel }: { teamCount: number; seasonLabel?: string | null },
): RecordCardBadge[] {
  const badges: RecordCardBadge[] = []
  if (league.format) {
    badges.push({ label: LEAGUE_FORMAT_LABELS[league.format], tone: 'format' })
  }
  badges.push({ label: `${teamCount} team${teamCount === 1 ? '' : 's'}`, tone: 'side' })
  if (seasonLabel) {
    badges.push({ label: seasonLabel, tone: 'season' })
  }
  badges.push(league.active ? { label: 'Active', tone: 'active' } : { label: 'Inactive', tone: 'muted' })
  return badges
}
