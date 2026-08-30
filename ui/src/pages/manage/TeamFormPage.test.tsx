import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamFormPage from './TeamFormPage'
import type { Team } from '../../api/teamApi'
import type { Section } from '../../api/sectionApi'
import type { ClubContact } from '../../api/clubContactApi'
import type { Sponsor } from '../../api/sponsorApi'
import type { ClubProfile } from '../../api/clubApi'

const listTeamsForSection = vi.fn()
const createTeam = vi.fn()
const updateTeam = vi.fn()
const listSections = vi.fn()
const getManagedClubProfile = vi.fn()
const listClubContacts = vi.fn()
const createClubContact = vi.fn()
const listTeamContacts = vi.fn()
const linkTeamContact = vi.fn()
const unlinkTeamContact = vi.fn()
const listSponsors = vi.fn()
const createSponsor = vi.fn()
const listTeamSponsors = vi.fn()
const linkTeamSponsor = vi.fn()
const unlinkTeamSponsor = vi.fn()

vi.mock('../../api/teamApi', () => ({
  listTeamsForSection: (clubId: string, sectionId: string) => listTeamsForSection(clubId, sectionId),
  createTeam: (clubId: string, sectionId: string, payload: unknown) => createTeam(clubId, sectionId, payload),
  updateTeam: (clubId: string, sectionId: string, teamId: string, payload: unknown) =>
    updateTeam(clubId, sectionId, teamId, payload),
}))

vi.mock('../../api/sectionApi', () => ({
  listSections: (clubId: string) => listSections(clubId),
}))

vi.mock('../../api/clubApi', () => ({
  getManagedClubProfile: (clubId: string) => getManagedClubProfile(clubId),
}))

vi.mock('../../api/clubContactApi', () => ({
  listClubContacts: (clubId: string) => listClubContacts(clubId),
  createClubContact: (clubId: string, payload: unknown) => createClubContact(clubId, payload),
}))

vi.mock('../../api/teamContactApi', () => ({
  listTeamContacts: (clubId: string, sectionId: string, teamId: string) => listTeamContacts(clubId, sectionId, teamId),
  linkTeamContact: (clubId: string, sectionId: string, teamId: string, contactId: string, role: string) =>
    linkTeamContact(clubId, sectionId, teamId, contactId, role),
  unlinkTeamContact: (clubId: string, sectionId: string, teamId: string, contactId: string) =>
    unlinkTeamContact(clubId, sectionId, teamId, contactId),
}))

vi.mock('../../api/sponsorApi', () => ({
  listSponsors: (clubId: string) => listSponsors(clubId),
  createSponsor: (clubId: string, payload: unknown) => createSponsor(clubId, payload),
}))

vi.mock('../../api/teamSponsorApi', () => ({
  listTeamSponsors: (clubId: string, sectionId: string, teamId: string) => listTeamSponsors(clubId, sectionId, teamId),
  linkTeamSponsor: (clubId: string, sectionId: string, teamId: string, sponsorId: string) =>
    linkTeamSponsor(clubId, sectionId, teamId, sponsorId),
  unlinkTeamSponsor: (clubId: string, sectionId: string, teamId: string, sponsorId: string) =>
    unlinkTeamSponsor(clubId, sectionId, teamId, sponsorId),
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Low-priority defaults so a background refetch beyond a test's own queued
  // mockResolvedValueOnce calls resolves to something rather than undefined — same convention
  // ClubStructure.test.tsx already uses.
  listSections.mockResolvedValue([])
  getManagedClubProfile.mockResolvedValue({ clubId: 'test-club-id', logoUrl: null } as ClubProfile)
  listClubContacts.mockResolvedValue([])
  listTeamContacts.mockResolvedValue([])
  listSponsors.mockResolvedValue([])
  listTeamSponsors.mockResolvedValue([])
})

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    clubId: 'test-club-id',
    sectionId: 'test-section-id',
    name: '1st XI',
    logoUrl: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 'test-section-id',
    clubId: 'test-club-id',
    parentSectionId: null,
    name: 'Men',
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

function makeContact(overrides: Partial<ClubContact> = {}): ClubContact {
  return {
    id: 'contact-1',
    clubId: 'test-club-id',
    contact: { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com', phone: '+27 21 555 0100' },
    role: 'Treasurer',
    isPrimary: false,
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
    name: 'Acme Bank',
    website: null,
    email: null,
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

// Same wrapper-route shape as ClubContactFormPage.test.tsx, reproducing ManagerHome's Outlet
// context without pulling ManagerHome itself in. Registers all three real routes TeamFormPage
// serves, per docs/specs/026-teams.md.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderPage(initialPath: string, clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="teams" element={<div>Team Directory Page</div>} />
            <Route path="teams/new" element={<TeamFormPage />} />
            <Route path="sections/:sectionId/teams" element={<div>Team List Page</div>} />
            <Route path="sections/:sectionId/teams/new" element={<TeamFormPage />} />
            <Route path="sections/:sectionId/teams/:teamId/edit" element={<TeamFormPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TeamFormPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/sections/test-section-id/teams/new', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listTeamsForSection).not.toHaveBeenCalled()
  })

  describe('section-scoped mode (sectionId in the route)', () => {
    it('create: renders the form with no section picker, and submit calls createTeam with the route sectionId, then navigates to the section-scoped list', async () => {
      const user = userEvent.setup()
      createTeam.mockResolvedValueOnce(makeTeam())

      renderPage('/manage/sections/test-section-id/teams/new', 'test-club-id')

      expect(screen.getByText('Add Team')).toBeInTheDocument()
      expect(screen.queryByLabelText('Section')).not.toBeInTheDocument()
      expect(listTeamsForSection).not.toHaveBeenCalled()

      await user.type(screen.getByLabelText('Name'), '1st XI')
      await user.click(screen.getByRole('button', { name: 'Create team' }))

      expect(createTeam).toHaveBeenCalledWith('test-club-id', 'test-section-id', { name: '1st XI', logoUrl: null })
      expect(await screen.findByText('Team List Page')).toBeInTheDocument()
    })

    it('create: does not render the Contacts/Sponsors sections — they only ever apply once a real team exists', async () => {
      renderPage('/manage/sections/test-section-id/teams/new', 'test-club-id')

      expect(await screen.findByText('Add Team')).toBeInTheDocument()
      expect(screen.queryByText('Contacts')).not.toBeInTheDocument()
      expect(screen.queryByText('Sponsors')).not.toBeInTheDocument()
      expect(listTeamContacts).not.toHaveBeenCalled()
      expect(listTeamSponsors).not.toHaveBeenCalled()
    })

    it('edit: fetches the section\'s team list and prefills from the matching team id, never showing a section picker', async () => {
      listTeamsForSection.mockResolvedValue([
        makeTeam({ id: 'team-1', name: '1st XI' }),
        makeTeam({ id: 'team-2', name: '2nd XI' }),
      ])

      renderPage('/manage/sections/test-section-id/teams/team-2/edit', 'test-club-id')

      expect(await screen.findByText('Edit Team')).toBeInTheDocument()
      expect(listTeamsForSection).toHaveBeenCalledWith('test-club-id', 'test-section-id')
      expect(await screen.findByDisplayValue('2nd XI')).toBeInTheDocument()
      expect(screen.queryByLabelText('Section')).not.toBeInTheDocument()
    })

    it('edit: renders an error state when the matching team id is not in the fetched list', async () => {
      listTeamsForSection.mockResolvedValueOnce([makeTeam({ id: 'some-other-id' })])

      renderPage('/manage/sections/test-section-id/teams/team-2/edit', 'test-club-id')

      expect(await screen.findByText("Couldn't load this team")).toBeInTheDocument()
    })

    it('edit: submit calls updateTeam with the outlet clubId, route sectionId, route teamId, and the (unchanged) logoUrl', async () => {
      const user = userEvent.setup()
      listTeamsForSection.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI', logoUrl: 'https://cdn.example.com/team.png' })])
      updateTeam.mockResolvedValueOnce(makeTeam({ id: 'team-1', name: '1st XI Renamed' }))

      renderPage('/manage/sections/test-section-id/teams/team-1/edit', 'test-club-id')

      await screen.findByText('Edit Team')
      await user.click(screen.getByRole('button', { name: 'Save changes' }))

      expect(updateTeam).toHaveBeenCalledWith('test-club-id', 'test-section-id', 'team-1', {
        name: '1st XI',
        logoUrl: 'https://cdn.example.com/team.png',
      })
      expect(await screen.findByText('Team List Page')).toBeInTheDocument()
    })

    it('edit: renders the full section-ancestry breadcrumb, not just the immediate section name', async () => {
      listTeamsForSection.mockResolvedValue([makeTeam({ id: 'team-1', sectionId: 'o15' })])
      listSections.mockResolvedValue([
        makeSection({ id: 'juniors', parentSectionId: null, name: 'Juniors' }),
        makeSection({ id: 'boys', parentSectionId: 'juniors', name: 'Boys' }),
        makeSection({ id: 'o15', parentSectionId: 'boys', name: 'O/15' }),
      ])

      renderPage('/manage/sections/o15/teams/team-1/edit', 'test-club-id')

      await screen.findByText('Edit Team')
      expect(await screen.findByText('Juniors')).toBeInTheDocument()
      expect(screen.getByText('Boys')).toBeInTheDocument()
      expect(screen.getByText('O/15')).toBeInTheDocument()
    })

    it('edit: renders Details/Contacts/Sponsors as tabs, one panel visible at a time, with the Save action only shown on Details', async () => {
      const user = userEvent.setup()
      listTeamsForSection.mockResolvedValue([makeTeam({ id: 'team-1', sectionId: 'test-section-id' })])

      renderPage('/manage/sections/test-section-id/teams/team-1/edit', 'test-club-id')

      await screen.findByText('Edit Team')
      // Details tab is active by default — the form and its Save button render, Contacts/Sponsors
      // panel content doesn't.
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
      expect(screen.queryByText('No contacts linked to this team yet.')).not.toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Contacts' }))
      expect(await screen.findByText('No contacts linked to this team yet.')).toBeInTheDocument()
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Sponsors' }))
      expect(await screen.findByText("This team's sponsors")).toBeInTheDocument()
      expect(screen.queryByText('No contacts linked to this team yet.')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Details' }))
      expect(await screen.findByLabelText('Name')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    })

    describe('edit mode: Contacts', () => {
      function renderEdit() {
        listTeamsForSection.mockResolvedValue([makeTeam({ id: 'team-1', sectionId: 'test-section-id' })])
        return renderPage('/manage/sections/test-section-id/teams/team-1/edit', 'test-club-id')
      }

      it('renders linked contacts with their team-specific role, and unlinks via unlinkTeamContact', async () => {
        const user = userEvent.setup()
        listTeamContacts.mockResolvedValue([
          { id: 'tc-1', contact: makeContact({ id: 'contact-1' }), role: 'Coach', createdAt: '2026-01-01T00:00:00Z' },
        ])
        renderEdit()

        await screen.findByText('Edit Team')
        await user.click(screen.getByRole('tab', { name: 'Contacts' }))

        expect(await screen.findByText('Jane Smith')).toBeInTheDocument()
        expect(screen.getByText('Coach')).toBeInTheDocument()
        expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument()
        // Real user feedback: the old bare Avatar+name row gave no way to see a linked record's
        // details or edit it — RecordCard's Edit link fixes that by navigating to the real
        // ClubContactFormPage edit route.
        expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/club-contacts/contact-1/edit')

        // RecordCard's secondaryAction always reads "Unlink" (not "Unlink {name}") — only one
        // contact is linked in this test, so it's unambiguous.
        await user.click(screen.getByRole('button', { name: 'Unlink' }))

        expect(unlinkTeamContact).toHaveBeenCalledWith('test-club-id', 'test-section-id', 'team-1', 'contact-1')
      })

      it('links an existing contact using the "Coach" role quick-fill', async () => {
        const user = userEvent.setup()
        listClubContacts.mockResolvedValue([makeContact({ id: 'contact-2', contact: { firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com', phone: '+27 21 555 0199' } })])
        renderEdit()

        await screen.findByText('Edit Team')
        await user.click(screen.getByRole('tab', { name: 'Contacts' }))
        // The Contacts tab panel is the only one rendered while active — its own "Link existing"
        // button is unambiguous now that Sponsors' isn't mounted alongside it.
        await user.click(await screen.findByRole('button', { name: 'Link existing' }))

        const combobox = await screen.findByRole('combobox', { name: 'Search contacts' })
        await user.click(combobox)
        await user.click(await screen.findByText(/Bob Jones/))

        await user.click(screen.getByRole('button', { name: 'Coach' }))
        expect(screen.getByLabelText('Role')).toHaveValue('Coach')

        await user.click(screen.getByRole('button', { name: 'Link' }))

        expect(linkTeamContact).toHaveBeenCalledWith('test-club-id', 'test-section-id', 'team-1', 'contact-2', 'Coach')
      })

      it('creates a new contact and links it with the given role in the same flow', async () => {
        const user = userEvent.setup()
        createClubContact.mockResolvedValueOnce(makeContact({ id: 'new-contact' }))
        renderEdit()

        await screen.findByText('Edit Team')
        await user.click(screen.getByRole('tab', { name: 'Contacts' }))
        await user.click(await screen.findByRole('button', { name: '+ New contact' }))

        // Two "Role" fields render simultaneously once the dialog opens — the dialog's own extra
        // team-specific role field (rendered first) and ClubContactForm's own club-wide role
        // field (rendered second, as part of the wrapped form).
        const roleFields = screen.getAllByLabelText('Role')
        await user.type(roleFields[0], 'Coach')
        await user.type(roleFields[1], 'Manager')

        await user.type(await screen.findByLabelText('First name'), 'Bob')
        await user.type(screen.getByLabelText('Last name'), 'Jones')
        await user.type(screen.getByLabelText('Email'), 'bob.jones@example.com')
        await user.type(screen.getByLabelText('Phone'), '+27 21 555 0199')

        await user.click(screen.getByRole('button', { name: 'Create & link' }))

        await waitFor(() => expect(createClubContact).toHaveBeenCalledTimes(1))
        await waitFor(() =>
          expect(linkTeamContact).toHaveBeenCalledWith('test-club-id', 'test-section-id', 'team-1', 'new-contact', 'Coach'),
        )
      })
    })

    describe('edit mode: Sponsors', () => {
      function renderEdit() {
        listTeamsForSection.mockResolvedValue([makeTeam({ id: 'team-1', sectionId: 'test-section-id' })])
        return renderPage('/manage/sections/test-section-id/teams/team-1/edit', 'test-club-id')
      }

      it('lists this team\'s own sponsors and unlinks via unlinkTeamSponsor', async () => {
        const user = userEvent.setup()
        listTeamSponsors.mockResolvedValue([
          makeSponsor({ id: 'sponsor-1', name: 'Acme Bank', website: 'https://acme.example.com' }),
        ])
        renderEdit()

        await screen.findByText('Edit Team')
        await user.click(screen.getByRole('tab', { name: 'Sponsors' }))

        expect(await screen.findByText('Acme Bank')).toBeInTheDocument()
        expect(screen.getByText('https://acme.example.com')).toBeInTheDocument()
        // Real user feedback: the old bare Avatar+name row gave no way to see or edit a linked
        // sponsor — RecordCard's Edit link fixes that by navigating to the real SponsorFormPage
        // edit route.
        expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/sponsors/sponsor-1/edit')

        await user.click(screen.getByRole('button', { name: 'Unlink' }))

        expect(unlinkTeamSponsor).toHaveBeenCalledWith('test-club-id', 'test-section-id', 'team-1', 'sponsor-1')
      })

      it('the "Club sponsors" read-only list excludes sponsors already linked to this team', async () => {
        const user = userEvent.setup()
        listTeamSponsors.mockResolvedValue([makeSponsor({ id: 'sponsor-1', name: 'Already Linked Co' })])
        listSponsors.mockResolvedValue([
          makeSponsor({ id: 'sponsor-1', name: 'Already Linked Co' }),
          makeSponsor({ id: 'sponsor-2', name: 'Other Sponsor Co' }),
        ])
        renderEdit()

        await screen.findByText('Edit Team')
        await user.click(screen.getByRole('tab', { name: 'Sponsors' }))

        expect(await screen.findByText('Club sponsors')).toBeInTheDocument()
        expect(screen.getByText('Other Sponsor Co')).toBeInTheDocument()
        // "Already Linked Co" appears once — in "This team's sponsors" — never a second time under
        // "Club sponsors".
        expect(screen.getAllByText('Already Linked Co')).toHaveLength(1)
      })

      it('links an existing sponsor directly (no extra field) via linkTeamSponsor', async () => {
        const user = userEvent.setup()
        listSponsors.mockResolvedValue([makeSponsor({ id: 'sponsor-2', name: 'Other Sponsor Co' })])
        renderEdit()

        await screen.findByText('Edit Team')
        await user.click(screen.getByRole('tab', { name: 'Sponsors' }))
        await user.click(await screen.findByRole('button', { name: 'Link existing' }))

        const combobox = await screen.findByRole('combobox', { name: 'Search sponsors' })
        await user.click(combobox)
        await user.click(await screen.findByRole('option', { name: 'Other Sponsor Co' }))

        expect(linkTeamSponsor).toHaveBeenCalledWith('test-club-id', 'test-section-id', 'team-1', 'sponsor-2')
      })

      it('creates a new sponsor and links it in the same flow', async () => {
        const user = userEvent.setup()
        createSponsor.mockResolvedValueOnce(makeSponsor({ id: 'new-sponsor' }))
        renderEdit()

        await screen.findByText('Edit Team')
        await user.click(screen.getByRole('tab', { name: 'Sponsors' }))
        await user.click(await screen.findByRole('button', { name: '+ New sponsor' }))

        const dialog = await screen.findByRole('dialog')
        await user.type(within(dialog).getByLabelText('Name'), 'Brand New Sponsor')
        await user.click(within(dialog).getByRole('button', { name: 'Create & link' }))

        await waitFor(() => expect(createSponsor).toHaveBeenCalledTimes(1))
        await waitFor(() =>
          expect(linkTeamSponsor).toHaveBeenCalledWith('test-club-id', 'test-section-id', 'team-1', 'new-sponsor'),
        )
      })
    })
  })

  describe('club-wide create mode (no sectionId in the route)', () => {
    it('fetches sections and renders the required section picker; submit calls createTeam with the chosen sectionId, then navigates to the directory', async () => {
      const user = userEvent.setup()
      listSections.mockResolvedValueOnce([makeSection({ id: 'section-1', name: 'Men' }), makeSection({ id: 'section-2', name: 'Women' })])
      createTeam.mockResolvedValueOnce(makeTeam({ sectionId: 'section-2' }))

      renderPage('/manage/teams/new', 'test-club-id')

      // The page renders nothing until listSections resolves (club-wide create mode fetches
      // sections before it can render TeamForm's picker) — same "renders nothing while loading"
      // posture as every other guarded /manage page.
      expect(await screen.findByText('Add Team')).toBeInTheDocument()
      const sectionPicker = screen.getByLabelText('Section')
      expect(sectionPicker).toBeInTheDocument()

      await user.click(sectionPicker)
      await user.click(await screen.findByRole('option', { name: 'Women' }))
      await user.type(screen.getByLabelText('Name'), '1st XI')
      await user.click(screen.getByRole('button', { name: 'Create team' }))

      expect(createTeam).toHaveBeenCalledWith('test-club-id', 'section-2', { name: '1st XI', logoUrl: null })
      expect(await screen.findByText('Team Directory Page')).toBeInTheDocument()
    })

    it('does not render the Contacts/Sponsors sections — no real team exists yet', async () => {
      listSections.mockResolvedValueOnce([makeSection({ id: 'section-1', name: 'Men' })])

      renderPage('/manage/teams/new', 'test-club-id')

      expect(await screen.findByText('Add Team')).toBeInTheDocument()
      expect(screen.queryByText('Contacts')).not.toBeInTheDocument()
      expect(screen.queryByText('Sponsors')).not.toBeInTheDocument()
    })
  })
})
