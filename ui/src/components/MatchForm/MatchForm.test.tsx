import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchForm, MATCH_FORM_ID, validateMatchLink } from './MatchForm'
import type { MatchFormProps } from './MatchForm'
import type { MatchPayload } from '../../api/matchApi'
import type { Team } from '../../api/teamApi'
import type { Season } from '../../api/seasonApi'
import type { League } from '../../api/leagueApi'
import type { LeagueAffiliation } from '../../api/leagueAffiliationApi'
import type { LeagueTeam } from '../../api/leagueTeamApi'

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
    abbreviation: null,
    groundName: null,
    socialLinks: [],
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
    matchCount: null,
    playedCount: null,
    firstMatchDate: null,
    lastMatchDate: null,
    nextMatchDate: null,
    teams: null,
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
    expect(screen.getByLabelText('League (optional)')).toBeInTheDocument()
  })

  it('defaults each side to "My team" and shows a team Select', () => {
    renderMatchForm()
    expect(screen.getByLabelText('Home team')).toBeInTheDocument()
    expect(screen.getByLabelText('Away team')).toBeInTheDocument()
  })

  it('switches the home side to a free-text opponent name field via the toggle', async () => {
    const user = userEvent.setup()
    renderMatchForm()

    // Both toggle groups render an "Other" button — click the first (Home)'s.
    const externalButtons = screen.getAllByRole('button', { name: 'Other' })
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

    const externalButtons = screen.getAllByRole('button', { name: 'Other' })
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
    it('renders the Logo MediaUpload field only for a side in "Other" mode', async () => {
      const user = userEvent.setup()
      renderMatchForm()

      // Both sides default to "My team" — no Logo field anywhere yet.
      expect(screen.queryByText('Logo')).not.toBeInTheDocument()

      const externalButtons = screen.getAllByRole('button', { name: 'Other' })
      await user.click(externalButtons[0])

      expect(screen.getByText('Logo')).toBeInTheDocument()
      expect(screen.getByLabelText('Logo file')).toBeInTheDocument()

      // Away side is still "My team" — only one Logo field renders, not two.
      expect(screen.getAllByText('Logo')).toHaveLength(1)
    })

    it('clears the side\'s uploaded logo when its toggle switches back to "My team"', async () => {
      const user = userEvent.setup()
      uploadManagedMedia.mockResolvedValueOnce({ url: '/media/managed/opponent-logo.png' })
      renderMatchForm()

      const externalButtons = screen.getAllByRole('button', { name: 'Other' })
      await user.click(externalButtons[0])

      const file = new File(['logo'], 'logo.png', { type: 'image/png' })
      await user.upload(screen.getByLabelText('Logo file'), file)
      expect(await screen.findByRole('button', { name: 'Replace' })).toBeInTheDocument()

      // Toggle home back to "My team", then to "Other" again — the logo
      // must be gone (a fresh "Upload Logo" empty state, not "Replace").
      const teamButtons = screen.getAllByRole('button', { name: 'My team' })
      await user.click(teamButtons[0])
      await user.click(screen.getAllByRole('button', { name: 'Other' })[0])

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

      await user.click(screen.getAllByRole('button', { name: 'Other' })[1])
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

// docs/specs/070-league-teams.md: the third side option and its grouped picker.
describe('MatchForm league teams', () => {
  function makeLeagueTeam(overrides: Partial<LeagueTeam> = {}): LeagueTeam {
    return {
      id: 'lt-1',
      leagueId: 'league-1',
      seasonId: 'season-1',
      name: 'Centurion Brits CC',
      abbreviation: 'CBC',
      logoUrl: null,
      active: true,
      referencedByMatchCount: 0,
      ...overrides,
    }
  }

  const LEAGUE_TEAMS = [
    makeLeagueTeam({ id: 'lt-1', name: 'Centurion Brits CC' }),
    makeLeagueTeam({ id: 'lt-2', name: 'Laudium Cricket Club', abbreviation: 'LCC' }),
    makeLeagueTeam({ id: 'lt-3', name: 'Ladium', abbreviation: 'LAD', active: false }),
  ]
  const SCOPE = { seasonId: 'season-1', leagueId: 'league-1' }
  const AFFILIATIONS = [makeAffiliation({ teamId: 'team-1' })]

  function renderWithTeams(props: Partial<MatchFormProps> = {}) {
    const merged: MatchFormProps = {
      teams: TEAMS,
      seasons: SEASONS,
      leagues: LEAGUES,
      affiliations: AFFILIATIONS,
      leagueTeams: LEAGUE_TEAMS,
      canUseLeagueTeams: true,
      onSubmit: vi.fn(),
      ...props,
    }
    render(
      <MemoryRouter>
        <MatchForm {...merged} />
        <button type="submit" form={MATCH_FORM_ID}>
          Submit
        </button>
      </MemoryRouter>,
    )
    return merged
  }

  it('shows a three-way toggle per side for a club admin', () => {
    renderWithTeams()
    expect(screen.getAllByRole('button', { name: 'My team' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'League team' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Other' })).toHaveLength(2)
  })

  it('keeps the two-way toggle for a non-admin', () => {
    renderWithTeams({ canUseLeagueTeams: false })
    expect(screen.queryByRole('button', { name: 'League team' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Other' })).toHaveLength(2)
  })

  it('disables League team with a hint until a league and season are chosen', () => {
    renderWithTeams()
    expect(screen.getAllByRole('button', { name: 'League team' })[0]).toBeDisabled()
    expect(screen.getAllByText('Choose a league and season first to pick a league team.')).toHaveLength(1)
  })

  it('groups Our teams and League teams, listing only active league teams', async () => {
    const user = userEvent.setup()
    renderWithTeams({ initialValues: SCOPE })
    await user.click(screen.getAllByRole('button', { name: 'League team' })[0])
    await user.click(screen.getByLabelText('Home league team'))

    expect(await screen.findByText('Our teams')).toBeInTheDocument()
    expect(screen.getByText('League teams')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /1st XI/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /2nd XI/ })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Centurion Brits CC/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Laudium Cricket Club/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Ladium/ })).not.toBeInTheDocument()
  })

  it('submits only the league team id for a league-team side', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderWithTeams({ onSubmit, initialValues: { ...SCOPE, homeTeamId: 'team-1' } })

    await user.click(screen.getAllByRole('button', { name: 'League team' })[1])
    await user.click(screen.getByLabelText('Away league team'))
    await user.click(await screen.findByRole('option', { name: /Laudium Cricket Club/ }))
    await user.type(screen.getByLabelText('Match date & time'), '2026-06-01T14:30')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    const payload = onSubmit.mock.calls[0][0] as MatchPayload
    expect(payload).toMatchObject({
      homeTeamId: 'team-1',
      homeLeagueTeamId: null,
      awayTeamId: null,
      awayTeamName: null,
      awayTeamLogoUrl: null,
      awayLeagueTeamId: 'lt-2',
    })
  })

  it('treats choosing an Our teams entry exactly like My team', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderWithTeams({ onSubmit, initialValues: { ...SCOPE, awayTeamId: 'team-1' } })

    await user.click(screen.getAllByRole('button', { name: 'League team' })[0])
    await user.click(screen.getByLabelText('Home league team'))
    await user.click(await screen.findByRole('option', { name: /1st XI/ }))

    // The picker switches that side back to My team with the team selected.
    expect(screen.getByLabelText('Home team')).toHaveTextContent('1st XI')
    await user.type(screen.getByLabelText('Match date & time'), '2026-06-01T14:30')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const payload = onSubmit.mock.calls[0][0] as MatchPayload
    expect(payload).toMatchObject({ homeTeamId: 'team-1', homeLeagueTeamId: null })
  })

  it('requires a league team once the League team toggle is chosen', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderWithTeams({ onSubmit, initialValues: SCOPE })
    await user.click(screen.getAllByRole('button', { name: 'League team' })[0])
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Choose a home league team')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows an empty-list helper linking to the league', async () => {
    const user = userEvent.setup()
    renderWithTeams({ initialValues: SCOPE, leagueTeams: [] })
    await user.click(screen.getAllByRole('button', { name: 'League team' })[0])
    expect(screen.getByText('No league teams registered for this league and season.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Teams tab/ })).toHaveAttribute('href', '/manage/fixtures/leagues/league-1/edit')
  })

  it('opens a stored league-team side on League team, showing an inactive pick with its suffix', async () => {
    const user = userEvent.setup()
    renderWithTeams({
      initialValues: { ...SCOPE, homeTeamName: 'Ladium', homeLeagueTeamId: 'lt-3', awayTeamName: 'Friendly XI' },
    })
    expect(screen.getByLabelText('Home league team')).toHaveTextContent('Ladium (Inactive)')
    // A free-text side stays on Other.
    expect(screen.getByLabelText('Away opponent name')).toHaveValue('Friendly XI')
    await user.click(screen.getByLabelText('Home league team'))
    expect(await screen.findByRole('option', { name: /Ladium \(Inactive\)/ })).toBeInTheDocument()
  })

  it('clears a league-team side with a notice when the season changes', async () => {
    const user = userEvent.setup()
    renderWithTeams({
      seasons: [makeSeason({ id: 'season-1', label: '2026' }), makeSeason({ id: 'season-2', label: '2027' })],
      initialValues: { ...SCOPE, homeTeamName: 'Centurion Brits CC', homeLeagueTeamId: 'lt-1', awayTeamId: 'team-1' },
    })
    expect(screen.getByLabelText('Home league team')).toHaveTextContent('Centurion Brits CC')

    await user.click(screen.getByLabelText('Season'))
    await user.click(await screen.findByRole('option', { name: '2027' }))

    expect(screen.getByText(/the league team was cleared/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Home league team')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Home team')).toBeInTheDocument()
  })

  it('reports the chosen league and season', () => {
    const onScopeChange = vi.fn()
    renderWithTeams({ initialValues: SCOPE, onScopeChange })
    expect(onScopeChange).toHaveBeenCalledWith('league-1', 'season-1')
  })
})

// docs/specs/075-match-view-and-edit.md section 6: the two optional link fields.
describe('MatchForm links', () => {
  async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByLabelText('Season'))
    await user.click(await screen.findByRole('option', { name: '2026' }))
    await user.click(screen.getByLabelText('Home team'))
    await user.click(await screen.findByRole('option', { name: '1st XI' }))
    await user.click(screen.getByLabelText('Away team'))
    await user.click(await screen.findByRole('option', { name: '2nd XI' }))
    await user.type(screen.getByLabelText('Match date & time'), '2026-06-01T14:30')
  }

  it('renders the optional Scoring and Streaming link fields with example placeholders and no helper text', () => {
    renderMatchForm()
    expect(screen.getByLabelText('Scoring link (optional)')).toHaveAttribute('placeholder', 'https://cricclubs.com/matches/34343')
    expect(screen.getByLabelText('Streaming link (optional)')).toHaveAttribute('placeholder', 'https://')
    expect(screen.queryByText(/^Optional\./)).not.toBeInTheDocument()
  })

  it('lays the form out as Match details and Teams sections with a panel per side', () => {
    renderMatchForm()
    expect(screen.getByRole('heading', { name: 'Match details' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Teams' })).toBeInTheDocument()
    expect(screen.getByTestId('match-side-home')).toBeInTheDocument()
    expect(screen.getByTestId('match-side-away')).toBeInTheDocument()
  })

  it('sends null for blank links', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderMatchForm({ onSubmit })
    await fillRequired(user)
    await user.type(screen.getByLabelText('Scoring link (optional)'), '   ')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    const payload = onSubmit.mock.calls[0][0] as MatchPayload
    expect(payload.scoringUrl).toBeNull()
    expect(payload.streamingUrl).toBeNull()
  })

  it('sends the trimmed value for a valid link', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderMatchForm({ onSubmit })
    await fillRequired(user)
    await user.type(screen.getByLabelText('Scoring link (optional)'), '  https://cricclubs.com/matches/34343 ')
    await user.type(screen.getByLabelText('Streaming link (optional)'), 'http://pitchvision.example/live')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    const payload = onSubmit.mock.calls[0][0] as MatchPayload
    expect(payload.scoringUrl).toBe('https://cricclubs.com/matches/34343')
    expect(payload.streamingUrl).toBe('http://pitchvision.example/live')
  })

  it('shows an error and does not submit for a scheme-less link', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderMatchForm({ onSubmit })
    await fillRequired(user)
    await user.type(screen.getByLabelText('Scoring link (optional)'), 'cricclubs.com/matches/34343')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Enter a valid link starting with http:// or https://')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows the length error for a 1025-character link', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderMatchForm({ onSubmit })
    await fillRequired(user)
    await user.click(screen.getByLabelText('Streaming link (optional)'))
    await user.paste(`https://${'a'.repeat(1025 - 8)}`)
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Link must be 1024 characters or fewer')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('validates each field independently', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderMatchForm({ onSubmit })
    await fillRequired(user)
    await user.type(screen.getByLabelText('Scoring link (optional)'), 'https://ok.example/1')
    await user.type(screen.getByLabelText('Streaming link (optional)'), 'ftp://bad.example')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findAllByText('Enter a valid link starting with http:// or https://')).toHaveLength(1)
    expect(screen.getByLabelText('Scoring link (optional)')).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Streaming link (optional)')).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('prefills the links from initialValues', () => {
    renderMatchForm({ initialValues: { scoringUrl: 'https://s.example/1', streamingUrl: 'https://t.example/2' } })
    expect(screen.getByLabelText('Scoring link (optional)')).toHaveValue('https://s.example/1')
    expect(screen.getByLabelText('Streaming link (optional)')).toHaveValue('https://t.example/2')
  })
})

describe('validateMatchLink', () => {
  it('accepts blank, http and https (any case), and exactly 1024 characters', () => {
    expect(validateMatchLink('')).toBeNull()
    expect(validateMatchLink('   ')).toBeNull()
    expect(validateMatchLink('http://a.example')).toBeNull()
    expect(validateMatchLink('HTTPS://A.example/x')).toBeNull()
    expect(validateMatchLink(`https://${'a'.repeat(1024 - 8)}`)).toBeNull()
  })

  it('rejects a missing or other scheme, an inner space and a bare scheme', () => {
    const message = 'Enter a valid link starting with http:// or https://'
    expect(validateMatchLink('cricclubs.com/x')).toBe(message)
    expect(validateMatchLink('javascript:alert(1)')).toBe(message)
    expect(validateMatchLink('ftp://x.example')).toBe(message)
    expect(validateMatchLink('https://a b.example')).toBe(message)
    expect(validateMatchLink('https://')).toBe(message)
  })

  it('rejects more than 1024 characters', () => {
    expect(validateMatchLink(`https://${'a'.repeat(1025 - 8)}`)).toBe('Link must be 1024 characters or fewer')
  })
})
