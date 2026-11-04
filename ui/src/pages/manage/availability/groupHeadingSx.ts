import { displayLabelSx } from '../../../theme'

// docs/specs/136 (owner, 2026-11-04): the section or team heading on the New Poll pages is large, in the display face, uppercase and green,
// so each block of fixtures is easy to find (the approved mockup's heading).
export const groupHeadingSx = { ...displayLabelSx, fontSize: { xs: 22, sm: 26 }, lineHeight: 1.1, fontWeight: 700, color: 'primary.dark' } as const

// Each section (Group page) or team (Squad page) is its own white card with a hairline and a little breathing room, so the blocks are easy
// to tell apart (owner, 2026-11-04: a divider line was not enough).
export const sectionCardSx = { border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', p: { xs: 1.5, sm: 2 } } as const
