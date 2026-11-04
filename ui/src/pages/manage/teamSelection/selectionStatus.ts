import type { RecordCardBadgeTone } from '../../../components/RecordCard'
import type { TeamSelectionStatus } from '../../../api/teamSelectionApi'

// docs/specs/093-team-selection-hub.md: how a selection status reads and which chip tone it gets, shared by the views.
export const STATUS_LABELS: Record<TeamSelectionStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  READY_TO_ANNOUNCE: 'Ready To Announce',
  ANNOUNCED: 'Announced',
}

export const STATUS_TONES: Record<TeamSelectionStatus, RecordCardBadgeTone> = {
  NOT_STARTED: 'warning',
  IN_PROGRESS: 'neutral',
  READY_TO_ANNOUNCE: 'side',
  ANNOUNCED: 'active',
}
