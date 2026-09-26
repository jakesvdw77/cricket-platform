import type { Gender, BattingStance, BowlingArm, BowlingType } from '../api/playerApi'

// Extracted from PlayerDetailPage.tsx (docs/specs/060-player-detail-redesign.md) once PlayerCard
// (docs/specs/061-player-card-avatar-redesign.md) needed the same Batting/Bowling label lookups
// for its own condensed "Bat: .../Bowl: ..." icon rows — a second consumer is this codebase's own
// signal to share rather than duplicate (docs/standards/frontend.md).
export const GENDER_LABEL: Record<Gender, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
}

export const BATTING_STANCE_LABEL: Record<BattingStance, string> = {
  RIGHT_HANDED: 'Right-handed',
  LEFT_HANDED: 'Left-handed',
}

export const BOWLING_ARM_LABEL: Record<BowlingArm, string> = {
  RIGHT_ARM: 'Right-arm',
  LEFT_ARM: 'Left-arm',
}

export const BOWLING_TYPE_LABEL: Record<BowlingType, string> = {
  FAST: 'Fast',
  FAST_MEDIUM: 'Fast-medium',
  MEDIUM_FAST: 'Medium-fast',
  MEDIUM: 'Medium',
  OFF_BREAK: 'Off break',
  LEG_BREAK: 'Leg break',
  ORTHODOX_SPIN: 'Orthodox spin',
  WRIST_SPIN: 'Wrist spin / Chinaman',
  GOOGLY: 'Googly',
}
