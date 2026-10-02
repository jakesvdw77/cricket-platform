import type { OpenAvailabilityPoll } from '../../../api/matchAvailabilityApi'
import type { SectionAvailabilityRound } from '../../../api/sectionAvailabilityApi'

// docs/specs/066: the one shape the unified PollCard (and its Matches dialog) takes for either kind
// of poll, so the dashboard hands both through the same prop.
export type PollItem = { kind: 'SQUAD'; poll: OpenAvailabilityPoll } | { kind: 'GROUP'; round: SectionAvailabilityRound }
