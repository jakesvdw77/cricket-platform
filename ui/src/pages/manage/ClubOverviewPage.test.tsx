import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubOverviewPage from './ClubOverviewPage'
import type { ClubProfile } from '../../api/clubApi'
import type { ClubContact } from '../../api/clubContactApi'
import type { Sponsor } from '../../api/sponsorApi'
import type { Section, SectionsSummary } from '../../api/sectionApi'
import type { Season } from '../../api/seasonApi'

const getManagedClubProfile = vi.fn()
const listClubContacts = vi.fn()
const listSponsors = vi.fn()
const listSections = vi.fn()
const listSeasons = vi.fn()
const getSectionsSummary = vi.fn()
const listSectionContacts = vi.fn()
const listTeamsForSection = vi.fn()

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
  return {
    ...actual,
    listSections: (clubId: string) => listSections(clubId),
    getSectionsSummary: (clubId: string, params: unknown) => getSectionsSummary(clubId, params),
    listSectionContacts: (clubId: string, sectionId: string) => listSectionContacts(clubId, sectionId),
  }
})

vi.mock('../../api/teamApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/teamApi')>()
  return { ...actual, listTeamsForSection: (clubId: string, sectionId: string) => listTeamsForSection(clubId, sectionId) }
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

function makeSummary(overrides: Partial<SectionsSummary> = {}): SectionsSummary {
  return {
    totals: { sections: 2, teams: 7, players: 42 },
    sections: [
      {
        sectionId: 'root-1',
        teamCount: 1,
        activeTeamCount: 1,
        playerCount: 10,
        subtreeTeamCount: 7,
        subtreePlayerCount: 42,
        leagues: [{ id: 'league-1', name: 'Premier League' }],
      },
      {
        sectionId: 'child-1',
        teamCount: 6,
        activeTeamCount: 6,
        playerCount: 32,
        subtreeTeamCount: 6,
        subtreePlayerCount: 32,
        leagues: [
          { id: 'league-1', name: 'Premier League' },
          { id: 'league-2', name: 'Cup' },
        ],
      },
    ],
    ...overrides,
  }
}

const TWO_SECTIONS = [
  makeSection({ id: 'root-1', name: 'Open Sides', parentSectionId: null }),
  makeSection({ id: 'child-1', name: '1st XI', parentSectionId: 'root-1', minAge: 16, maxAge: 40 }),
]

function mockPhone() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
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
  summary = makeSummary(),
}: {
  contacts?: ClubContact[]
  sponsors?: Sponsor[]
  sections?: Section[]
  seasons?: Season[]
  summary?: SectionsSummary
} = {}) {
  listClubContacts.mockResolvedValue(contacts)
  listSponsors.mockResolvedValue(sponsors)
  listSections.mockResolvedValue(sections)
  listSeasons.mockResolvedValue(seasons)
  getSectionsSummary.mockReturnValue(Promise.resolve(summary))
  listSectionContacts.mockResolvedValue([])
  listTeamsForSection.mockResolvedValue([])
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
      // docs/specs/091 (E): Edit is always the filled primary button.
      expect(screen.getByRole('link', { name: /edit profile/i }).className).toContain('MuiButton-contained')
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

  describe('page structure', () => {
    it('has no Seasons card and no plain section list', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sections: TWO_SECTIONS, seasons: [makeSeason()] })

      renderPage('test-club-id')

      await screen.findByRole('button', { name: 'Open Sides' })
      expect(screen.queryByText('Seasons')).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /add season/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Edit structure' })).not.toBeInTheDocument()
      expect(screen.queryByText('Back to Dashboard')).not.toBeInTheDocument()
    })
  })

  describe('key figures', () => {
    it('shows Teams, Leagues (distinct across sections) and Players from the summary', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sections: TWO_SECTIONS })

      renderPage('test-club-id')

      await screen.findByTestId('club-figure-teams-value')
      await waitFor(() => expect(screen.getByTestId('club-figure-teams-value')).toHaveTextContent('7'))
      await waitFor(() => expect(screen.getByTestId('club-figure-players-value')).toHaveTextContent('42'))
      expect(screen.getByTestId('club-figure-leagues-value')).toHaveTextContent('2')
      expect(screen.getByTestId('club-figure-teams')).toHaveTextContent('Teams')
      expect(screen.getByTestId('club-figure-leagues')).toHaveTextContent('Leagues')
    })

    it('shows muted dashes while the summary loads', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sections: TWO_SECTIONS })
      getSectionsSummary.mockReturnValue(new Promise(() => {}))

      renderPage('test-club-id')

      expect(await screen.findByTestId('club-figure-teams-value')).toHaveTextContent('\u2013')
      expect(screen.getByTestId('club-figure-players-value')).toHaveTextContent('\u2013')
    })

    it('hides the strip, and still renders the page, when the summary fails', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sections: TWO_SECTIONS })
      getSectionsSummary.mockImplementation(() => Promise.reject(new Error('boom')))

      renderPage('test-club-id')

      await screen.findByRole('button', { name: 'Open Sides' })
      await waitFor(() => expect(screen.queryByTestId('club-key-figures')).not.toBeInTheDocument())
      expect(screen.getByRole('heading', { name: 'Riverside Cricket Club' })).toBeInTheDocument()
    })
  })

  describe('Club structure card', () => {
    it('shows the empty state with a "Set up your structure" link when the club has zero sections', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sections: [] })

      renderPage('test-club-id')

      expect(await screen.findByText('No sections yet')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Set up your structure' })).toHaveAttribute('href', '/manage/sections')
    })

    it('renders the org chart with every section as a node', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sections: TWO_SECTIONS })

      renderPage('test-club-id')

      expect(await screen.findByRole('button', { name: 'Open Sides' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '1st XI' })).toBeInTheDocument()
      expect(screen.queryByTestId('section-info-panel')).not.toBeInTheDocument()
    })

    it('clicking a node shows the read-only panel with its Edit link, and Close clears it', async () => {
      const user = userEvent.setup()
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sections: TWO_SECTIONS })

      renderPage('test-club-id')

      await user.click(await screen.findByRole('button', { name: '1st XI' }))

      const drawer = (await screen.findByRole('heading', { name: '1st XI' })).closest('.MuiDrawer-paper') as HTMLElement
      const panel = within(drawer).getByTestId('section-info-panel')
      expect(within(drawer).getByRole('heading', { name: '1st XI' })).toBeInTheDocument()
      expect(within(panel).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
      expect(within(panel).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/sections?sectionId=child-1')
      expect(within(panel).getByRole('link', { name: /manage teams/i })).toHaveAttribute('href', '/manage/sections/child-1/teams')
      expect(listTeamsForSection).toHaveBeenCalledWith('test-club-id', 'child-1')
      expect(listSectionContacts).toHaveBeenCalledWith('test-club-id', 'child-1')

      await user.click(within(drawer).getByRole('button', { name: 'Close section details' }))
      await waitFor(() => expect(screen.queryByTestId('section-info-panel')).not.toBeInTheDocument())
    })

    it('Escape clears the selection', async () => {
      const user = userEvent.setup()
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sections: TWO_SECTIONS })

      renderPage('test-club-id')

      await user.click(await screen.findByRole('button', { name: 'Open Sides' }))
      await screen.findByTestId('section-info-panel')
      await user.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByTestId('section-info-panel')).not.toBeInTheDocument())
    })

    it('is read-only: no plus buttons and no Add top-level section, and Manage links to /manage/sections', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sections: TWO_SECTIONS })

      renderPage('test-club-id')

      await screen.findByRole('button', { name: 'Open Sides' })
      expect(screen.queryByRole('button', { name: /Add a child section/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add top-level section' })).not.toBeInTheDocument()
      const card = screen.getByTestId('club-structure-card')
      expect(within(card).getByRole('link', { name: 'Manage' })).toHaveAttribute('href', '/manage/sections')
    })
  })

  describe('Club Details card', () => {
    it('has a Manage link to the edit form', async () => {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists()

      renderPage('test-club-id')

      const heading = await screen.findByText('Club Details')
      const card = heading.closest('[class*="MuiCard-root"]') as HTMLElement
      expect(within(card).getByRole('link', { name: 'Manage' })).toHaveAttribute('href', '/manage/club-profile/edit')
    })
  })

  describe('expanded club structure', () => {
    async function openOverlay(user: ReturnType<typeof userEvent.setup>) {
      getManagedClubProfile.mockResolvedValueOnce(makeProfile())
      mockAllLists({ sections: TWO_SECTIONS })
      renderPage('test-club-id')
      await user.click(await screen.findByRole('button', { name: 'Expand club structure' }))
      return screen.findByRole('dialog', { name: 'Club structure' })
    }

    it('opens a full-screen overlay with the read-only chart and zoom controls', async () => {
      const user = userEvent.setup()
      const dialog = await openOverlay(user)

      expect(within(dialog).getByRole('button', { name: 'Open Sides' })).toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: /Add a child section/ })).not.toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Zoom in' })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Fit to screen' })).toBeInTheDocument()

      await user.click(within(dialog).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Club structure' })).not.toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'Expand club structure' })).toBeInTheDocument()
    })

    it('selecting a node opens the drawer over the overlay; closing the drawer keeps the overlay', async () => {
      const user = userEvent.setup()
      const dialog = await openOverlay(user)

      await user.click(within(dialog).getByRole('button', { name: '1st XI' }))
      const drawerHeading = await screen.findByRole('heading', { name: '1st XI' })
      const drawer = drawerHeading.closest('.MuiDrawer-paper') as HTMLElement
      expect(within(drawer).getByTestId('section-info-panel')).toBeInTheDocument()

      await user.click(within(drawer).getByRole('button', { name: 'Close section details' }))
      await waitFor(() => expect(screen.queryByTestId('section-info-panel')).not.toBeInTheDocument())
      expect(screen.getByRole('dialog', { name: 'Club structure' })).toBeInTheDocument()
    })

    it('Escape closes the drawer first, then the overlay', async () => {
      const user = userEvent.setup()
      const dialog = await openOverlay(user)

      await user.click(within(dialog).getByRole('button', { name: '1st XI' }))
      await screen.findByTestId('section-info-panel')

      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByTestId('section-info-panel')).not.toBeInTheDocument())
      expect(screen.getByRole('dialog', { name: 'Club structure' })).toBeInTheDocument()

      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Club structure' })).not.toBeInTheDocument())
    })
  })

  describe('on a phone', () => {
    it('shows the nested list instead of the chart and opens the details in the slide-in sheet', async () => {
      const user = userEvent.setup()
      mockPhone()
      try {
        getManagedClubProfile.mockResolvedValueOnce(makeProfile())
        mockAllLists({ sections: TWO_SECTIONS })

        renderPage('test-club-id')

        expect(await screen.findByRole('tree')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Open Sides' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Add a child section/ })).not.toBeInTheDocument()
        expect(screen.getByText('16\u201340')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Expand club structure' })).not.toBeInTheDocument()

        await user.click(screen.getByText('1st XI'))

        const panel = await screen.findByTestId('section-info-panel')
        expect(screen.getByRole('button', { name: 'Close section details' })).toBeInTheDocument()
        expect(within(panel).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/sections?sectionId=child-1')
      } finally {
        delete (window as { matchMedia?: unknown }).matchMedia
      }
    })
  })
})
