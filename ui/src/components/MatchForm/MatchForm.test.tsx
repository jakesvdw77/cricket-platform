import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchForm, MATCH_FORM_ID } from './MatchForm'
import type { MatchFormProps } from './MatchForm'
import type { MatchPayload } from '../../api/matchApi'
import type { Team } from '../../api/teamApi'
import type { Season } from '../../api/seasonApi'
import type { League } from '../../api/leagueApi'
import type { LeagueAffiliation } from '../../api/leagueAffiliationApi'

// docs/specs/050-league-schedule-and-fixtures.md: MatchForm's per-side external-opponent logo
// renders via the real MediaUpload component (namespace="manage"), so its own uploadManagedMedia
// call needs mocking here the same way MediaUpload.test.tsx mocks it directly.
const uploadMedia = vi.fn()
const uploadManagedMedia = vi.fn()

vi.mock('../../api/mediaApi', () => ({
  uploadMedia: (file: File) => uploadMedia(file),
  uploadManagedMedia: (file: File) => uploadManagedMedia(file),
}))

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    clubId: 'club-1',
    sectionId: 'section-1',
    name: '1st XI',
    logoUrl: null,
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
    clubId: 'club-1',
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

function makeLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    clubId: 'club-1',
    name: 'Internal League',
    source: 'INTERNAL',
    maxPlayingXiSize: 11,
    minAge: null,
    maxAge: null,
    ageCutoffDate: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    currentSeasonTeamCount: 2,
    currentSeasonLabel: '2026',
    currentSeasonPlayingConditionsUrl: null,
    format: null,
    logoUrl: null,
    phone: null,
    website: null,
    email: null,
    socialLinks: [],
    ...overrides,
  }
}

function makeAffiliation(overrides: Partial<LeagueAffiliation> = {}): LeagueAffiliation {
  return {
    id: 'affiliation-1',
    leagueId: 'league-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: null,
    ...overrides,
  }
}

const TEAMS: Team[] = [
  makeTeam({ id: 'team-1', name: '1st XI' }),
  makeTeam({ id: 'team-2', name: '2nd XI' }),
  makeTeam({ id: 'team-3', name: 'O/13A' }),
]
const SEASONS: Season[] = [makeSeason({ id: 'season-1', label: '2026' })]
const LEAGUES: League[] = [makeLeague({ id: 'league-1', name: 'Internal League' })]

beforeEach(() => {
  vi.clearAllMocks()
})

function renderMatchForm(props: Partial<MatchFormProps> = {}, submitLabel = 'Submit') {
  const merged: MatchFormProps = {
    teams: TEAMS,
    seasons: SEASONS,
    leagues: LEAGUES,
    affiliations: [],
    onSubmit: vi.fn(),
    ...props,
  }
  render(
    <>
      <MatchForm {...merged} />
      <button type="submit" form={MATCH_FORM_ID}>
        {submitLabel}
      </button>
    </>,
  )
  return merged
}

describe('MatchForm', () => {
  it('renders a required Season select and an optional League select', () => {
    renderMatchForm()
    expect(screen.getByLabelText('Season')).toBeInTheDocument()
    expect(screen.getByLabelText('League')).toBeInTheDocument()
  })

  it('defaults each side to "One of our teams" and shows a team Select', () => {
    renderMatchForm()
    expect(screen.getByLabelText('Home team')).toBeInTheDocument()
    expect(screen.getByLabelText('Away team')).toBeInTheDocument()
  })

  it('switches the home side to a free-text opponent name field via the toggle', async () => {
    const user = userEvent.setup()
    renderMatchForm()

    // Both toggle groups render an "External opponent" button — click the first (Home)'s.
    const externalButtons = screen.getAllByRole('button', { name: 'External opponent' })
    await user.click(externalButtons[0])

    expect(screen.getByLabelText('Home opponent name')).toBeInTheDocument()
    expect(screen.queryByLabelText('Home team')).not.toBeInTheDocument()
  })

  it('requires a season, a match date, and a home/away side before submitting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderMatchForm({ onSubmit })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Season is required')).toBeInTheDocument()
    expect(screen.getByText('Match date is required')).toBeInTheDocument()
    expect(screen.getByText('Choose a home team')).toBeInTheDocument()
    expect(screen.getByText('Choose an away team')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a team-vs-team match with the expected payload shape', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderMatchForm({ onSubmit })

    await user.click(screen.getByLabelText('Season'))
    await user.click(await screen.findByRole('option', { name: '2026' }))

    await user.click(screen.getByLabelText('Home team'))
    await user.click(await screen.findByRole('option', { name: '1st XI' }))

    await user.click(screen.getByLabelText('Away team'))
    await user.click(await screen.findByRole('option', { name: '2nd XI' }))

    await user.type(screen.getByLabelText('Match date & time'), '2026-06-01T14:30')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as MatchPayload
    expect(payload).toMatchObject({
      homeTeamId: 'team-1',
      homeTeamName: null,
      awayTeamId: 'team-2',
      awayTeamName: null,
      leagueId: null,
      seasonId: 'season-1',
      venue: null,
    })
    expect(payload.matchDate).toEqual(expect.any(String))
  })

  it('submits an external-opponent away side as a free-text name with no awayTeamId', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderMatchForm({ onSubmit })

    await user.click(screen.getByLabelText('Season'))
    await user.click(await screen.findByRole('option', { name: '2026' }))

    await user.click(screen.getByLabelText('Home team'))
    await user.click(await screen.findByRole('option', { name: '1st XI' }))

    const externalButtons = screen.getAllByRole('button', { name: 'External opponent' })
    await user.click(externalButtons[1])
    await user.type(screen.getByLabelText('Away opponent name'), 'Riverside Occasionals')

    await user.type(screen.getByLabelText('Match date & time'), '2026-06-01T14:30')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    const payload = onSubmit.mock.calls[0][0] as MatchPayload
    expect(payload.awayTeamId).toBeNull()
    expect(payload.awayTeamName).toEqual('Riverside Occasionals')
  })

  it('prefills an external opponent name into "external" mode', () => {
    renderMatchForm({ initialValues: { homeTeamName: 'Riverside Occasionals', seasonId: 'season-1' } })

    expect(screen.getByLabelText('Home opponent name')).toHaveValue('Riverside Occasionals')
  })

  // docs/specs/029-league-management.md: LeagueAffiliation narrowing, closing the same class of
  // bug reported live against MatchList's search suggestions (042) — a team not entered into the
  // selected League/Season must not be offered as Home/Away, since it doesn't actually play there.
  describe('LeagueAffiliation narrowing', () => {
    const AFFILIATIONS: LeagueAffiliation[] = [
      makeAffiliation({ id: 'affiliation-1', teamId: 'team-1' }),
      makeAffiliation({ id: 'affiliation-2', teamId: 'team-2' }),
    ]

    it('offers every team when no League is selected yet, even with affiliations loaded', async () => {
      const user = userEvent.setup()
      renderMatchForm({ affiliations: AFFILIATIONS })

      await user.click(screen.getByLabelText('Home team'))
      expect(await screen.findByRole('option', { name: '1st XI' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '2nd XI' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'O/13A' })).toBeInTheDocument()
    })

    it('narrows Home/Away options to only teams affiliated with the selected League and Season', async () => {
      const user = userEvent.setup()
      renderMatchForm({
        affiliations: AFFILIATIONS,
        initialValues: { seasonId: 'season-1', leagueId: 'league-1' },
      })

      await user.click(screen.getByLabelText('Home team'))
      expect(await screen.findByRole('option', { name: '1st XI' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '2nd XI' })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: 'O/13A' })).not.toBeInTheDocument()
      expect(screen.getAllByText('Only teams affiliated with this League for this Season')).toHaveLength(2)
    })

    it('still shows an already-selected team even if it falls outside the narrowed affiliation set', async () => {
      const user = userEvent.setup()
      renderMatchForm({
        affiliations: AFFILIATIONS,
        initialValues: { seasonId: 'season-1', leagueId: 'league-1', homeTeamId: 'team-3' },
      })

      expect(screen.getByLabelText('Home team')).toHaveTextContent('O/13A')
      await user.click(screen.getByLabelText('Home team'))
      expect(await screen.findByRole('option', { name: 'O/13A' })).toBeInTheDocument()
    })
  })

  // docs/specs/050-league-schedule-and-fixtures.md item 22: an external-opponent side's optional
  // logo, captured via the same MediaUpload control TeamForm already uses.
  describe('external-opponent logo', () => {
    it('renders the Logo MediaUpload field only for a side in "External opponent" mode', async () => {
      const user = userEvent.setup()
      renderMatchForm()

      // Both sides default to "One of our teams" — no Logo field anywhere yet.
      expect(screen.queryByText('Logo')).not.toBeInTheDocument()

      const externalButtons = screen.getAllByRole('button', { name: 'External opponent' })
      await user.click(externalButtons[0])

      expect(screen.getByText('Logo')).toBeInTheDocument()
      expect(screen.getByLabelText('Logo file')).toBeInTheDocument()

      // Away side is still "One of our teams" — only one Logo field renders, not two.
      expect(screen.getAllByText('Logo')).toHaveLength(1)
    })

    it('clears the side\'s uploaded logo when its toggle switches back to "One of our teams"', async () => {
      const user = userEvent.setup()
      uploadManagedMedia.mockResolvedValueOnce({ url: '/media/managed/opponent-logo.png' })
      renderMatchForm()

      const externalButtons = screen.getAllByRole('button', { name: 'External opponent' })
      await user.click(externalButtons[0])

      const file = new File(['logo'], 'logo.png', { type: 'image/png' })
      await user.upload(screen.getByLabelText('Logo file'), file)
      expect(await screen.findByRole('button', { name: 'Replace' })).toBeInTheDocument()

      // Toggle home back to "One of our teams", then to "External opponent" again — the logo
      // must be gone (a fresh "Upload Logo" empty state, not "Replace").
      const teamButtons = screen.getAllByRole('button', { name: 'One of our teams' })
      await user.click(teamButtons[0])
      await user.click(screen.getAllByRole('button', { name: 'External opponent' })[0])

      expect(screen.getByRole('button', { name: 'Upload Logo' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument()
    })

    it('submits the uploaded logo only for the external side, never for a real-Team side', async () => {
      const user = userEvent.setup()
      uploadManagedMedia.mockResolvedValueOnce({ url: '/media/managed/riverside-logo.png' })
      const onSubmit = vi.fn()
      renderMatchForm({ onSubmit })

      await user.click(screen.getByLabelText('Season'))
      await user.click(await screen.findByRole('option', { name: '2026' }))

      await user.click(screen.getByLabelText('Home team'))
      await user.click(await screen.findByRole('option', { name: '1st XI' }))

      await user.click(screen.getAllByRole('button', { name: 'External opponent' })[1])
      await user.type(screen.getByLabelText('Away opponent name'), 'Riverside Occasionals')

      const file = new File(['logo'], 'logo.png', { type: 'image/png' })
      await user.upload(screen.getByLabelText('Logo file'), file)
      await screen.findByRole('button', { name: 'Replace' })

      await user.type(screen.getByLabelText('Match date & time'), '2026-06-01T14:30')
      await user.click(screen.getByRole('button', { name: 'Submit' }))

      expect(onSubmit).toHaveBeenCalledTimes(1)
      const payload = onSubmit.mock.calls[0][0] as MatchPayload
      expect(payload.awayTeamLogoUrl).toEqual('/media/managed/riverside-logo.png')
      expect(payload.homeTeamLogoUrl).toBeNull()
    })
  })
})
