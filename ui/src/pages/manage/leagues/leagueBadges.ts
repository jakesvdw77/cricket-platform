import type { RecordCardBadge } from '../../../components/RecordCard'
import { LEAGUE_FORMAT_LABELS } from '../../../api/leagueApi'
import type { League } from '../../../api/leagueApi'

// docs/specs/091-leagues-gold-standard.md: the badges shared by the league card and the league page header - the format
// (when set), then Active or Inactive. The team count and the season label are no longer badges: the card has a Teams
// block and the pages have the Season pill.
export function leagueBadges(league: League): RecordCardBadge[] {
  const badges: RecordCardBadge[] = []
  if (league.format) {
    badges.push({ label: LEAGUE_FORMAT_LABELS[league.format], tone: 'format' })
  }
  badges.push(league.active ? { label: 'Active', tone: 'active' } : { label: 'Inactive', tone: 'muted' })
  return badges
}
