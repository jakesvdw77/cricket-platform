import { useOutletContext, useParams } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { TeamsPage } from './teams/TeamsPage'

// Reads sectionId from the route and clubId from ManagerHome's Outlet context (docs/specs/020-club-manager-access.md),
// same guard pattern as SponsorContactList.tsx. The page itself - Season pill, counters, FilterBar, Cards | List - is the
// shared TeamsPage (docs/specs/092-teams-gold-standard.md), here fixed to one section.
export default function TeamList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { sectionId } = useParams<{ sectionId: string }>()

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (!sectionId) {
    return <EmptyState title="Not found" description="No section was specified." />
  }

  return <TeamsPage clubId={clubId} scope={{ kind: 'section', sectionId }} />
}
