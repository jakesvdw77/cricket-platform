import type { RecordCardBadgeTone } from '../../../components/RecordCard'
import type { TeamSelectionStatus } from '../../../api/teamSelectionApi'

// docs/specs/093-team-selection-hub.md: how a selection status reads and which chip tone it gets, shared by the views.
export const STATUS_LABELS: Record<TeamSelectionStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  READY_TO_ANNOUNCE: 'Ready to announce',
  ANNOUNCED: 'Announced',
}

export const STATUS_TONES: Record<TeamSelectionStatus, RecordCardBadgeTone> = {
  NOT_STARTED: 'warning',
  IN_PROGRESS: 'neutral',
  READY_TO_ANNOUNCE: 'side',
  ANNOUNCED: 'active',
}
