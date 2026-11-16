// How big the text (and the pictures beside it) is on a picture template: Auto fits it to the room, the other steps scale the Auto
// size up, never past what fits. One remembered choice shared by every picture template (result image and TV, match image and TV,
// league poster), so they all behave the same.
export type ShareTextSize = 'AUTO' | 'LARGE' | 'LARGER' | 'LARGEST'

export const SHARE_TEXT_SIZES: ShareTextSize[] = ['AUTO', 'LARGE', 'LARGER', 'LARGEST']
export const SHARE_TEXT_SIZE_LABELS: Record<ShareTextSize, string> = { AUTO: 'Auto', LARGE: 'Large', LARGER: 'Larger', LARGEST: 'Largest' }
export const SHARE_TEXT_SCALE: Record<ShareTextSize, number> = { AUTO: 1, LARGE: 1.2, LARGER: 1.4, LARGEST: 1.6 }
