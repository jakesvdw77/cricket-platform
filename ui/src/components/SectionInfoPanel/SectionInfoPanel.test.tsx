import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SectionInfoPanel } from './SectionInfoPanel'
import type { SectionInfoPanelProps } from './SectionInfoPanel'
import type { Section, SectionSummary } from '../../api/sectionApi'
import type { Team } from '../../api/teamApi'
import type { ClubContact } from '../../api/clubContactApi'

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 'section-1',
    clubId: 'club-1',
    parentSectionId: null,
    name: 'Section',
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

const JUNIORS = makeSection({ id: 'juniors', name: 'Juniors' })
const BOYS = makeSection({ id: 'boys', name: 'Boys', parentSectionId: 'juniors', minAge: 6, maxAge: 9, gender: 'MALE' })
const U9 = makeSection({ id: 'u9', name: 'U9', parentSectionId: 'boys' })
const U11 = makeSection({ id: 'u11', name: 'U11', parentSectionId: 'boys', active: false })
const SECTIONS = [JUNIORS, BOYS, U9, U11]

const SUMMARY: SectionSummary = {
  sectionId: 'boys',
  teamCount: 2,
  activeTeamCount: 1,
  playerCount: 10,
  subtreeTeamCount: 5,
  subtreePlayerCount: 10,
  leagues: [{ id: 'league-1', name: 'Saturday League' }],
}

function team(overrides: Partial<Team>): Team {
  return {
    id: 't1',
    clubId: 'club-1',
    sectionId: 'boys',
    name: 'Boys 1st',
    logoUrl: null,
    abbreviation: null,
    groundName: null,
    socialLinks: [],
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ...overrides,
  }
}

const CONTACT: ClubContact = {
  id: 'c1',
  clubId: 'club-1',
  contact: { firstName: 'Ada', lastName: 'Lovelace', email: 'a@x.test', phone: '1' },
  role: 'Coach',
  isPrimary: false,
  active: true,
  photoUrl: null,
  createdAt: '',
  updatedAt: '',
  updatedBy: null,
}

function renderPanel(overrides: Partial<SectionInfoPanelProps> = {}) {
  const props: SectionInfoPanelProps = {
    section: BOYS,
    sections: SECTIONS,
    summary: SUMMARY,
    seasonLabel: '2026/27',
    teams: [team({ id: 't1', name: 'Boys 1st' }), team({ id: 't2', name: 'Boys 2nd', active: false })],
    contacts: [CONTACT],
    onClose: vi.fn(),
    onSelectSection: vi.fn(),
    onRetry: vi.fn(),
    editTo: '/manage/sections?sectionId=boys',
    manageTeamsTo: '/manage/sections/boys/teams',
    teamTo: (t) => `/manage/sections/boys/teams/${t.id}`,
    leagueTo: (l) => `/manage/leagues/${l.id}`,
    ...overrides,
  }
  render(
    <MemoryRouter>
      <SectionInfoPanel {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('SectionInfoPanel (docs/specs/094)', () => {
  it('shows the breadcrumb, name, Active badge and the two link buttons', () => {
    renderPanel()
    const path = screen.getByLabelText('Section path')
    expect(within(path).getByText('Juniors')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Boys' })).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/sections?sectionId=boys')
    expect(screen.getByRole('link', { name: 'Manage teams' })).toHaveAttribute('href', '/manage/sections/boys/teams')
  })

  it('shows Inactive for an inactive section', () => {
    renderPanel({ section: { ...BOYS, active: false } })
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('shows every eligibility field', () => {
    renderPanel()
    const eligibility = screen.getByRole('region', { name: 'Eligibility' })
    expect(within(eligibility).getByText('6 to 9 years')).toBeInTheDocument()
    expect(within(eligibility).getByText('Male')).toBeInTheDocument()
    expect(within(eligibility).getByText('Juniors')).toBeInTheDocument()
  })

  it('shows a dash for an empty age range and parent, and Not specified for gender', () => {
    renderPanel({ section: JUNIORS, sections: [JUNIORS] })
    const fields = within(screen.getByRole('region', { name: 'Eligibility' })).getAllByTestId('section-panel-field')
    expect(within(fields[0]).getByText('–')).toBeInTheDocument()
    expect(within(fields[1]).getByText('Not specified')).toBeInTheDocument()
    expect(within(fields[2]).getByText('–')).toBeInTheDocument()
  })

  it('counts direct active sub-sections and adds subtree captions only when different', () => {
    renderPanel()
    expect(screen.getByTestId('section-panel-subsections-value')).toHaveTextContent('1')
    expect(screen.getByTestId('section-panel-teams-value')).toHaveTextContent('2')
    expect(screen.getByText('Teams (5 with sub-sections)')).toBeInTheDocument()
    expect(screen.getByTestId('section-panel-players-value')).toHaveTextContent('10')
    expect(screen.getByText('Players')).toBeInTheDocument()
    expect(screen.queryByText(/Players \(/)).not.toBeInTheDocument()
  })

  it('selects a sub-section from its chip', async () => {
    const props = renderPanel()
    await userEvent.click(within(screen.getByRole('region', { name: 'Sub-sections' })).getByText('U9'))
    expect(props.onSelectSection).toHaveBeenCalledWith('u9')
  })

  it('shows a dash when there are no sub-sections', () => {
    renderPanel({ section: U9 })
    expect(within(screen.getByRole('region', { name: 'Sub-sections' })).getByText('–')).toBeInTheDocument()
  })

  it('links team and league chips and says so when there are none', () => {
    renderPanel()
    expect(screen.getByRole('link', { name: 'Boys 1st' })).toHaveAttribute('href', '/manage/sections/boys/teams/t1')
    expect(screen.getByRole('region', { name: 'Leagues in 2026/27' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Saturday League' })).toHaveAttribute('href', '/manage/leagues/league-1')
  })

  it('shows the empty messages for teams and leagues', () => {
    renderPanel({ teams: [], summary: { ...SUMMARY, leagues: [] } })
    expect(screen.getByText('No teams yet')).toBeInTheDocument()
    expect(screen.getByText('Not entered in a league this season')).toBeInTheDocument()
  })

  it('lists linked contacts read-only, or a dash', () => {
    renderPanel()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Coach')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unlink/i })).not.toBeInTheDocument()
  })

  it('shows a dash when no contacts are linked', () => {
    renderPanel({ contacts: [] })
    expect(within(screen.getByRole('region', { name: 'Linked contacts' })).getByText('–')).toBeInTheDocument()
  })

  it('shows skeleton rows while loading', () => {
    renderPanel({ summary: undefined, teamsLoading: true, contactsLoading: true })
    expect(screen.getAllByTestId('section-panel-skeleton').length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByText('No teams yet')).not.toBeInTheDocument()
  })

  it('shows the error with Retry and leaves the rest alone', async () => {
    const props = renderPanel({ summary: undefined, error: true })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load this section's details.")
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(props.onRetry).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Boys' })).toBeInTheDocument()
  })

  it('closes', async () => {
    const props = renderPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalled()
  })

  it('embedded leaves out the name heading and Close but keeps the path, badge and buttons', () => {
    renderPanel({ embedded: true })
    expect(screen.queryByRole('heading', { name: 'Boys' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Section path')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/sections?sectionId=boys')
    expect(screen.getByRole('link', { name: /manage teams/i })).toBeInTheDocument()
  })

  it('embedded shows a flat compact stat row with the subtree note on its own line', () => {
    renderPanel({ embedded: true })
    expect(screen.getByTestId('section-panel-subsections-value')).toHaveTextContent('1')
    expect(screen.getByTestId('section-panel-teams-value')).toHaveTextContent('2')
    expect(screen.getByText('5 with sub-sections')).toBeInTheDocument()
    expect(screen.getByTestId('section-panel-players-value')).toHaveTextContent('10')
    expect(screen.queryByText(/Players \(/)).not.toBeInTheDocument()
    expect(screen.getByTestId('section-info-panel').className).not.toContain('MuiCard')
  })

  it('embedded uses friendly empty wording', () => {
    renderPanel({ embedded: true, section: JUNIORS, sections: [JUNIORS], contacts: [] })
    const fields = within(screen.getByRole('region', { name: 'Eligibility' })).getAllByTestId('section-panel-field')
    expect(within(fields[0]).getByText('Not set')).toBeInTheDocument()
    expect(within(fields[1]).getByText('Not specified')).toBeInTheDocument()
    expect(within(fields[2]).getByText('Not set')).toBeInTheDocument()
    expect(screen.getByText('No sub-sections')).toBeInTheDocument()
    expect(screen.getByText('No linked contacts')).toBeInTheDocument()
  })
})
