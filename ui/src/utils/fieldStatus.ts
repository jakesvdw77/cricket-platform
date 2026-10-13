import type { RecordCardBadge } from '../components/RecordCard'
import type { FieldVerificationStatus, PlayingArea } from '../api/playingAreaApi'

// docs/specs/099-fields-directory.md: the one definition of a field's verification state for the card, the list view, the
// Status menu, the detail page and the match flags - the shape of utils/playerStatus.ts. There is no "suspended": a
// rejected field is reopened, not reactivated, and a verified field has no status change.
export type FieldStatus = 'verified' | 'unverified' | 'rejected'

export type FieldStatusAction = 'verify' | 'reject' | 'reopen'

export function fieldStatusOf(field: Pick<PlayingArea, 'verificationStatus'>): FieldStatus {
  return fieldStatusFrom(field.verificationStatus)
}

export function fieldStatusFrom(status: FieldVerificationStatus | null | undefined): FieldStatus {
  if (status === 'UNVERIFIED') return 'unverified'
  if (status === 'REJECTED') return 'rejected'
  return 'verified'
}

export const FIELD_STATUS_LABEL: Record<FieldStatus, string> = {
  verified: 'Verified',
  unverified: 'Unverified',
  rejected: 'Rejected',
}

// Only the valid changes from each status: Unverified can be verified or rejected, a Verified field has none, a Rejected one
// is reopened (the server refuses Rejected -> Verified).
export const FIELD_STATUS_ACTIONS: Record<FieldStatus, FieldStatusAction[]> = {
  unverified: ['verify', 'reject'],
  verified: [],
  rejected: ['reopen'],
}

export const FIELD_STATUS_ACTION_LABEL: Record<FieldStatusAction, string> = {
  verify: 'Verify',
  reject: 'Reject',
  reopen: 'Reopen',
}

const BADGE_TONE: Record<FieldStatus, RecordCardBadge['tone']> = {
  verified: 'positive',
  unverified: 'warning',
  rejected: 'closed',
}

export function fieldStatusBadge(status: FieldStatus): RecordCardBadge {
  return { label: FIELD_STATUS_LABEL[status], tone: BADGE_TONE[status] }
}

export const VERIFIED_FIELD_NO_ACTIONS = 'A verified field has no status changes.'

export interface FieldEditState {
  editable: boolean
  // Why Edit is disabled, for its tooltip; null when editable.
  reason: string | null
}

// A club manager may edit a field only while it is unverified and their club captured it (the API enforces the same).
export function fieldEditState(
  field: Pick<PlayingArea, 'verificationStatus' | 'createdByClubId'>,
  clubId: string | undefined,
): FieldEditState {
  if (field.verificationStatus === 'UNVERIFIED') {
    if (clubId && field.createdByClubId === clubId) return { editable: true, reason: null }
    return { editable: false, reason: 'Only the club that captured this field can change it until it is verified.' }
  }
  return { editable: false, reason: 'Only a platform admin can change a verified field.' }
}
