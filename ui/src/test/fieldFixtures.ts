import type { Page } from '../api/productApi'
import type { PlayingArea } from '../api/playingAreaApi'

// Shared fixtures for the Fields directory tests (docs/specs/099-fields-directory.md).
export function makeField(overrides: Partial<PlayingArea> = {}): PlayingArea {
  return {
    id: 'field-1',
    name: 'Riverside Oval',
    category: 'CLUB',
    ownerType: 'CLUB',
    ownerName: 'Riverside CC',
    address: { number: '12', street: 'River Road', city: 'Hilton', provinceState: 'KwaZulu-Natal', country: 'ZA', postalCode: '3245' },
    mapUrl: 'https://maps.example.com/riverside',
    locationNotes: null,
    verificationStatus: 'VERIFIED',
    verifiedAt: '2026-09-01T10:00:00Z',
    rejectionReason: null,
    createdByClubId: 'club-1',
    createdByClubName: 'Riverside CC',
    createdAt: '2026-08-01T10:00:00Z',
    linkedHome: false,
    matchCount: 3,
    ...overrides,
  }
}

export function fieldPage(content: PlayingArea[], extra: Partial<Page<PlayingArea>> = {}): Page<PlayingArea> {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 20, ...extra }
}
