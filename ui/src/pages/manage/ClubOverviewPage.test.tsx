import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubOverviewPage from './ClubOverviewPage'
import type { ClubProfile } from '../../api/clubApi'
import type { ClubContact } from '../../api/clubContactApi'
import type { Sponsor } from '../../api/sponsorApi'
import type { Section } from '../../api/sectionApi'
import type { Season } from '../../api/seasonApi'

const getManagedClubProfile = vi.fn()
const listClubContacts = vi.fn()
const listSponsors = vi.fn()
const listSections = vi.fn()
const listSeasons = vi.fn()

vi.mock('../../api/clubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubApi')>()
  return { ...actual, getManagedClubProfile: (clubId: string) => getManagedClubProfile(clubId) }
})

vi.mock('../../api/clubContactApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubContactApi')>()
  return { ...actual, listClubContacts: (clubId: string) => listClubContacts(clubId) }
})

vi.mock('../../api/sponsorApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/sponsorApi')>()
  return { ...actual, listSponsors: (clubId: string) => listSponsors(clubId) }
})

vi.mock('../../api/sectionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/sectionApi')>()
  return { ...actual, listSections: (clubId: string) => listSections(clubId) }
})

vi.mock('../../api/seasonApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/seasonApi')>()
  return { ...actual, listSeasons: (clubId: string) => listSeasons(clubId) }
})

beforeEach(() => {
  vi.clearAllMocks()
})

function makeProfile(overrides: Partial<ClubProfile> = {}): ClubProfile {
  return {
    clubId: 'test-club-id',
    name: 'Riverside Cricket Club',
    type: 'CLUB',
    logoUrl: null,
    bannerUrl: null,
    address: null,
    email: null,
    phone: null,
    website: null,
    socialLinks: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeContact(overrides: Partial<ClubContact> = {}): ClubContact {
  return {
    id: 'contact-1',
    clubId: 'test-club-id',
    contact: { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', phone: '+27 82 555 0101' },
    role: 'Club Secretary',
    isPrimary: true,
    active: true,
    photoUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeSponsor(overrides: Partial<Sponsor> = {}): Sponsor {
  return {
    id: 'sponsor-1',
    clubId: 'test-club-id',
    name: 'Acme Cricket Gear',
    website: 'acmecricket.example',
    email: 'hello@acmecricket.example',
    phone: null,
    logoUrl: null,
    bannerUrl: null,
    socialLinks: [],
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 'section-1',
    clubId: 'test-club-id',
    parentSectionId: null,
    name: 'Open Sides',
    minAge: null,
    maxAge: null,
    gender: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    clubId: 'test-club-id',
    label: '2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderPage(clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/club-profile']}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="club-profile" element={<ClubOverviewPage />} />
            <Route path="club-profile/edit" element={<div>Edit Club Profile Page</div>} />
            <Route path="club-contacts" element={<div>Club Contacts Page</div>} />
            <Route path="club-contacts/:id/edit" element={<div>Edit Club Contact Page</div>} />
            <Route path="sponsors" element={<div>Sponsors Page</div>} />
            <Route path="sponsors/:id/edit" element={<div>Edit Sponsor Page</div>} />
            <Route path="sections" element={<div>Club Structure Page</div>} />
            <Route path="fixtures/seasons/new" element={<div>Add Season Page</div>} />
            <Route path="fixtures/seasons/:id/edit" element={<div>Edit Season Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function mockAllLists({
  contacts = [],
  sponsors = [],
  sections = [],
  seasons = [],
}: { contacts?: ClubContact[]; sponsors?: Sponsor[]; sections?: Section[]; seasons?: Season[] } = {}) {
  listClubContacts.mockResolvedValue(contacts)
  listSponsors.mockResolvedValue(sponsors)
  listSections.mockResolvedValue(sections)
  listSeasons.mockResolvedValue(seasons)
}

describe('ClubOverviewPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(getManagedClubProfile).not.toHaveBeenCalled()
  })

  it('renders nothing while the profile is loading', () => {
    getManagedClubProfile.mockReturnValueOnce(new Promise(() => {}))
    mockAllLists()

    renderPage('test-club-id')

    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('renders an error state when the profile fetch fails', async () => {
    getManagedClubProfile.mockRejectedValueOnce(new Error('network error'))
    mockAllLists()

    renderPage('test-club-id')

    expect(await screen.findByText("Couldn't load your club")).toBeInTheDocument()
  })

  describe('header', () => {
    it('renders the club name, type chip, and an Edit profile link to club-profile/edit', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile({ type: 'ACADEMY' }))
      mockAllLists()

      renderPage('test-club-id')

      expect(await screen.findByRole('heading', { name: 'Riverside Cricket Club' })).toBeInTheDocument()
      expect(screen.getByText('Academy')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /edit profile/i })).toHaveAttribute('href', '/manage/club-profile/edit')
    })

    it('falls back to initials in the avatar when logoUrl is unset', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile({ logoUrl: null }))
      mockAllLists()

      renderPage('test-club-id')

      await screen.findByRole('heading', { name: 'Riverside Cricket Club' })
      const avatar = document.querySelector('.MuiAvatar-root')
      expect(avatar).toHaveTextContent('RC')
      expect(avatar?.querySelector('img')).not.toBeInTheDocument()
    })
  })

  describe('profile details card', () => {
    it('omits phone/email/website rows when unset, and shows the empty state when nothing is set', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists()

      renderPage('test-club-id')

      await screen.findByRole('heading', { name: 'Riverside Cricket Club' })
      expect(screen.getByText(/no contact details yet/i)).toBeInTheDocument()
      expect(screen.queryByText('Phone')).not.toBeInTheDocument()
      expect(screen.queryByText('Email')).not.toBeInTheDocument()
      expect(screen.queryByText('Website')).not.toBeInTheDocument()
    })

    it('renders phone/email/website rows when set', async () => {
      getManagedClubProfile.mockResolvedValueOnce(
        makeProfile({ phone: '+27 21 555 0199', email: 'info@riverside.example', website: 'riverside.example' }),
      )
      mockAllLists()

      renderPage('test-club-id')

      await screen.findByRole('heading', { name: 'Riverside Cricket Club' })
      expect(screen.getByText('+27 21 555 0199')).toBeInTheDocument()
      expect(screen.getByText('info@riverside.example')).toBeInTheDocument()
      expect(screen.getByText('riverside.example')).toBeInTheDocument()
    })

    it('renders one address row only when at least one Address field is set', async () => {
      getManagedClubProfile.mockResolvedValueOnce(
        makeProfile({
          address: { number: '12', street: 'Oval Road', city: 'Riverside', provinceState: null, country: null, postalCode: null },
        }),
      )
      mockAllLists()

      renderPage('test-club-id')

      await screen.findByRole('heading', { name: 'Riverside Cricket Club' })
      expect(screen.getByText('Address')).toBeInTheDocument()
      expect(screen.getByText(/12 Oval Road, Riverside/)).toBeInTheDocument()
    })

    it('omits the address row when every Address field is unset', async () => {
      getManagedClubProfile.mockResolvedValueOnce(
        makeProfile({
          address: { number: null, street: null, city: null, provinceState: null, country: null, postalCode: null },
        }),
      )
      mockAllLists()

      renderPage('test-club-id')

      await screen.findByRole('heading', { name: 'Riverside Cricket Club' })
      expect(screen.queryByText('Address')).not.toBeInTheDocument()
    })

    it('renders SocialLinksRow only when socialLinks is non-empty', async () => {
      getManagedClubProfile.mockResolvedValueOnce(
        makeProfile({ phone: '+27 21 555 0199', socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/riverside' }] }),
      )
      mockAllLists()

      renderPage('test-club-id')

      await screen.findByRole('heading', { name: 'Riverside Cricket Club' })
      expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', 'https://facebook.com/riverside')
    })
  })

  describe('Contacts card', () => {
    it('shows the empty state when the club has no contacts', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ contacts: [] })

      renderPage('test-club-id')

      expect(await screen.findByText('No contacts yet.')).toBeInTheDocument()
    })

    it('renders one icon button per contact, and the Manage button targets /manage/club-contacts', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ contacts: [makeContact()] })

      renderPage('test-club-id')

      await screen.findByRole('heading', { name: 'Riverside Cricket Club' })
      expect(screen.getByRole('button', { name: 'Jane Smith — Club Secretary' })).toBeInTheDocument()

      const manageLinks = screen.getAllByRole('link', { name: 'Manage' })
      expect(manageLinks.some((link) => link.getAttribute('href') === '/manage/club-contacts')).toBe(true)
    })

    it('clicking a contact icon opens RecordQuickViewDialog with that contact\'s Email/Phone fields and its own edit link', async () => {
      const user = userEvent.setup()
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ contacts: [makeContact({ id: 'contact-9' })] })

      renderPage('test-club-id')

      await user.click(await screen.findByRole('button', { name: 'Jane Smith — Club Secretary' }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('jane@example.com')).toBeInTheDocument()
      expect(within(dialog).getByText('+27 82 555 0101')).toBeInTheDocument()
      expect(within(dialog).getByRole('link', { name: 'Edit' })).toHaveAttribute(
        'href',
        '/manage/club-contacts/contact-9/edit',
      )
    })
  })

  describe('Sponsors card', () => {
    it('shows the empty state when the club has no sponsors', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sponsors: [] })

      renderPage('test-club-id')

      expect(await screen.findByText('No sponsors yet.')).toBeInTheDocument()
    })

    it('renders one icon button per sponsor, and the Manage button targets /manage/sponsors', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sponsors: [makeSponsor()] })

      renderPage('test-club-id')

      await screen.findByRole('button', { name: 'Acme Cricket Gear — Sponsor' })

      const manageLinks = screen.getAllByRole('link', { name: 'Manage' })
      expect(manageLinks.some((link) => link.getAttribute('href') === '/manage/sponsors')).toBe(true)
    })

    it('clicking a sponsor icon opens RecordQuickViewDialog with Website/Email fields and its own edit link', async () => {
      const user = userEvent.setup()
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sponsors: [makeSponsor({ id: 'sponsor-9' })] })

      renderPage('test-club-id')

      await user.click(await screen.findByRole('button', { name: 'Acme Cricket Gear — Sponsor' }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('acmecricket.example')).toBeInTheDocument()
      expect(within(dialog).getByText('hello@acmecricket.example')).toBeInTheDocument()
      expect(within(dialog).getByRole('link', { name: 'Edit' })).toHaveAttribute(
        'href',
        '/manage/sponsors/sponsor-9/edit',
      )
    })
  })

  describe('Structure card', () => {
    it('shows the empty state when the club has zero sections', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sections: [] })

      renderPage('test-club-id')

      expect(await screen.findByText('No sections yet.')).toBeInTheDocument()
    })

    it('renders a nested name-only tree grouped by parentSectionId, and "Edit structure" targets /manage/sections', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({
        sections: [
          makeSection({ id: 'root-1', name: 'Open Sides', parentSectionId: null }),
          makeSection({ id: 'child-1', name: '1st XI', parentSectionId: 'root-1' }),
        ],
      })

      renderPage('test-club-id')

      await screen.findByText('Open Sides')
      expect(screen.getByText('1st XI')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Edit structure' })).toHaveAttribute('href', '/manage/sections')
    })
  })

  describe('Seasons card', () => {
    it('shows the empty state when the club has zero seasons, and "Add season" targets fixtures/seasons/new', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ seasons: [] })

      renderPage('test-club-id')

      expect(await screen.findByText('No seasons yet.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /add season/i })).toHaveAttribute('href', '/manage/fixtures/seasons/new')
    })

    it('renders a "Current" chip on the season whose date range contains today, and an edit link per row', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({
        seasons: [
          makeSeason({ id: 'season-past', label: '2020', startDate: '2020-01-01', endDate: '2020-12-31' }),
          makeSeason({ id: 'season-current', label: '2026', startDate: '2026-01-01', endDate: '2026-12-31' }),
        ],
      })

      renderPage('test-club-id')

      await screen.findByText('2026')
      expect(screen.getByText('Current')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Edit 2026' })).toHaveAttribute(
        'href',
        '/manage/fixtures/seasons/season-current/edit',
      )
    })
  })
})
