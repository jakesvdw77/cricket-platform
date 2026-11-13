import type { MyClubContact, MyClubContactPage, MyClubInfo } from '../api/meClubInfoApi'
import type { HubSettings } from '../api/hubSettingsApi'

// docs/specs/148 test fixtures: the Club info read, a contact and a contact page. A test overrides what it needs.
export function makeClubInfo(overrides: Partial<MyClubInfo> = {}): MyClubInfo {
  return {
    clubName: 'Riverside CC',
    tabs: [{ id: 'about', count: null }, { id: 'contacts', count: 3 }, { id: 'links', count: 2 }],
    about: {
      type: 'CLUB',
      address: { number: '12', street: 'Oval Road', city: 'Durban', provinceState: 'KZN', country: 'South Africa', postalCode: '4001' },
      phone: '+27 31 555 0100',
      email: 'office@riverside.example',
    },
    links: { website: 'https://riverside.example', social: [{ platform: 'facebook', url: 'https://www.facebook.com/riverside' }] },
    logos: { logoUrl: 'https://cdn.example/logo.png', bannerUrl: 'https://cdn.example/banner.jpg', downloadable: true },
    directory: { total: 3, phoneShown: true, emailShown: true },
    ...overrides,
  }
}

export function makeContact(overrides: Partial<MyClubContact> = {}): MyClubContact {
  return { id: 'c1', firstName: 'Ayesha', lastName: 'Khan', role: 'Chairperson', primary: false, phone: '082 555 0101', email: 'ayesha@example.com', ...overrides }
}

export function makeContactPage(items: MyClubContact[], overrides: Partial<MyClubContactPage> = {}): MyClubContactPage {
  return { items, letters: ['K', 'N'], page: 0, size: 25, total: items.length, hasMore: false, ...overrides }
}

export function makeHubSettings(overrides: Partial<HubSettings> = {}): HubSettings {
  return {
    identityShown: true,
    contactShown: true,
    linksShown: true,
    logosShown: true,
    logoDownloadAllowed: false,
    directoryShown: true,
    directoryPhoneShown: true,
    directoryEmailShown: false,
    ...overrides,
  }
}
