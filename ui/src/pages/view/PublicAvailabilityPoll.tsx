import { useParams } from 'react-router-dom'
import { PublicAvailabilityFlow, squadAdapter } from '../../components/PublicAvailability/PublicAvailabilityFlow'

// docs/specs/032 + 077: the public, no-login squad poll page. A top-level route with no shell
// (reachable pre-login); everything is in the shared flow, this only supplies the poll id and the
// squad adapter.
export default function PublicAvailabilityPoll() {
  const { pollId } = useParams<{ pollId: string }>()
  return <PublicAvailabilityFlow id={pollId ?? ''} adapter={squadAdapter} />
}
