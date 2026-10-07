import { useParams } from 'react-router-dom'
import { PublicAvailabilityFlow, groupAdapter } from '../../components/PublicAvailability/PublicAvailabilityFlow'

// docs/specs/063 + 077: the public, no-login group poll (section availability round) page, a thin
// wrapper around the shared flow with the group adapter.
export default function PublicSectionAvailabilityRound() {
  const { roundId } = useParams<{ roundId: string }>()
  return <PublicAvailabilityFlow id={roundId ?? ''} adapter={groupAdapter} />
}
