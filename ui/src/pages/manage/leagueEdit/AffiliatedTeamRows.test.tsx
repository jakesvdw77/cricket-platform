import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AffiliatedTeamRows } from './AffiliatedTeamRows'
import type { LeagueAffiliation } from '../../../api/leagueAffiliationApi'
import type { Team } from '../../../api/teamApi'

const unaffiliateLeagueTeam = vi.fn()
vi.mock('../../../api/leagueAffiliationApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/leagueAffiliationApi')>()
  return { ...actual, unaffiliateLeagueTeam: (...args: unknown[]) => unaffiliateLeagueTeam(...args) }
})

const team = (id: string, name: string) => ({ id, name, sectionId: 'sec-1', logoUrl: null }) as unknown as Team
const affiliation = (id: string, teamId: string) =>
  ({ id, leagueId: 'league-1', teamId, seasonId: 'season-1', createdAt: '', createdBy: null }) as LeagueAffiliation

const TEAMS = new Map([
  ['t-1', team('t-1', '1st XI')],
  ['t-2', team('t-2', '2nd XI')],
])

function renderRows(props: Partial<React.ComponentProps<typeof AffiliatedTeamRows>> = {}) {
  const onAddTeam = vi.fn()
  const onUnlinked = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AffiliatedTeamRows
          clubId="club-1"
          leagueId="league-1"
          seasonLabel="2026/27"
          affiliations={[affiliation('aff-1', 't-1'), affiliation('aff-2', 't-2')]}
          teamsById={TEAMS}
          canAdd
          onAddTeam={onAddTeam}
          onUnlinked={onUnlinked}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { onAddTeam, onUnlinked }
}

beforeEach(() => {
  vi.clearAllMocks()
  unaffiliateLeagueTeam.mockResolvedValue(undefined)
})

describe('AffiliatedTeamRows', () => {
  it('renders the heading with the count and one row per team with initials', () => {
    renderRows()
    expect(screen.getByRole('heading', { name: 'Our teams · 2' })).toBeInTheDocument()
    const rows = screen.getAllByTestId('affiliated-team-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('1st XI')).toBeInTheDocument()
    expect(within(rows[0]).getByText('1X')).toBeInTheDocument()
  })

  it('links Edit to the team edit page', () => {
    renderRows()
    expect(screen.getByRole('link', { name: 'Edit 1st XI' })).toHaveAttribute('href', '/manage/sections/sec-1/teams/t-1/edit')
  })

  it('has exactly one filled button, Add team, which calls onAddTeam', async () => {
    const user = userEvent.setup()
    const { onAddTeam } = renderRows()
    const filled = screen.getAllByRole('button').filter((button) => button.classList.contains('MuiButton-contained'))
    expect(filled.map((button) => button.textContent)).toEqual(['Add team'])
    await user.click(screen.getByRole('button', { name: 'Add team' }))
    expect(onAddTeam).toHaveBeenCalledTimes(1)
  })

  it('disables Add team without a season', () => {
    renderRows({ canAdd: false })
    expect(screen.getByRole('button', { name: 'Add team' })).toBeDisabled()
  })

  it('shows the quiet empty line and keeps Add team', () => {
    renderRows({ affiliations: [] })
    expect(screen.getByText('No teams affiliated for this season yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add team' })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Our teams · 0' })).toBeInTheDocument()
  })

  it('asks before unaffiliating, then calls the API for that row only', async () => {
    const user = userEvent.setup()
    const { onUnlinked } = renderRows()
    await user.click(screen.getByRole('button', { name: 'Unaffiliate 2nd XI' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Unaffiliate 2nd XI from this season?')).toBeInTheDocument()
    expect(within(dialog).getByText(/for 2026\/27/)).toBeInTheDocument()
    expect(unaffiliateLeagueTeam).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Unaffiliate' }))
    await waitFor(() => expect(unaffiliateLeagueTeam).toHaveBeenCalledWith('club-1', 'league-1', 'aff-2'))
    await waitFor(() => expect(onUnlinked).toHaveBeenCalledTimes(1))
  })

  it('does nothing when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    renderRows()
    await user.click(screen.getByRole('button', { name: 'Unaffiliate 1st XI' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(unaffiliateLeagueTeam).not.toHaveBeenCalled()
  })

  it('keeps the pending state on the row being removed', async () => {
    const user = userEvent.setup()
    unaffiliateLeagueTeam.mockReturnValue(new Promise(() => undefined))
    renderRows()
    await user.click(screen.getByRole('button', { name: 'Unaffiliate 1st XI' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Unaffiliate' }))
    expect(await within(dialog).findByRole('button', { name: 'Removing...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Unaffiliate 1st XI', hidden: true })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Unaffiliate 2nd XI', hidden: true })).toBeEnabled()
  })
})
