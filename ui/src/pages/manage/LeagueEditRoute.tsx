import { useParams } from 'react-router-dom'
import LeagueFormPage from './LeagueFormPage'

// docs/specs/096-duplicate-league.md: the edit route's element. Going from /leagues/A/edit to /leagues/B/edit (Duplicate
// league does exactly that) keeps the same route match, so React would reuse one LeagueFormPage and carry A's season and
// other local state into B and ignore B's ?seasonId=. Keying the page by league id gives each league a fresh instance.
export function LeagueEditRoute() {
  const { leagueId } = useParams<{ leagueId?: string }>()
  return <LeagueFormPage key={leagueId ?? 'new'} />
}
