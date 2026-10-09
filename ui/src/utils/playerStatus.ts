import type { RecordCardBadge } from '../components/RecordCard'
import type { Player } from '../api/playerApi'

// docs/specs/088-players-polls-alignment.md: the one definition of a player's status for the card, the Status menu and
// the Player page. "Suspended" is a deactivated player (`active: false`) and wins over the verification status, which
// is kept underneath.
export type PlayerStatus = 'verified' | 'unverified' | 'rejected' | 'suspended'

export type PlayerStatusAction = 'verify' | 'reject' | 'suspend' | 'reactivate'

export function playerStatusOf(player: Pick<Player, 'active' | 'verificationStatus'>): PlayerStatus {
  if (!player.active) return 'suspended'
  if (player.verificationStatus === 'UNVERIFIED') return 'unverified'
  if (player.verificationStatus === 'REJECTED') return 'rejected'
  return 'verified'
}

export const PLAYER_STATUS_LABEL: Record<PlayerStatus, string> = {
  verified: 'Verified',
  unverified: 'Unverified',
  rejected: 'Rejected',
  suspended: 'Suspended',
}

// Only the changes that are valid from each status (the spec's table): Unverified can be verified or rejected, Verified
// can be suspended, Rejected can be verified again, Suspended can be reactivated.
export const PLAYER_STATUS_ACTIONS: Record<PlayerStatus, PlayerStatusAction[]> = {
  unverified: ['verify', 'reject'],
  verified: ['suspend'],
  rejected: ['verify'],
  suspended: ['reactivate'],
}

export const PLAYER_STATUS_ACTION_LABEL: Record<PlayerStatusAction, string> = {
  verify: 'Verify',
  reject: 'Reject',
  suspend: 'Suspend',
  reactivate: 'Reactivate',
}

// Badge tones reuse the shared RecordCard tones: verified is the calm positive tint, unverified the amber warning,
// rejected the closed (red) tone, suspended the muted grey.
const BADGE_TONE: Record<PlayerStatus, RecordCardBadge['tone']> = {
  verified: 'positive',
  unverified: 'warning',
  rejected: 'closed',
  suspended: 'muted',
}

export function playerStatusBadge(status: PlayerStatus): RecordCardBadge {
  return { label: PLAYER_STATUS_LABEL[status], tone: BADGE_TONE[status] }
}
