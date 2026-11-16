import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { baseTheme } from '../../theme'
import { mockCanvas } from '../ShareResultDialog/shareScreenTestUtils'
import { ShareSquadDialog } from './ShareSquadDialog'

const listSquad = vi.fn()
const getManagedClubProfile = vi.fn()
const listSponsors = vi.fn()
vi.mock('../../api/teamSquadApi', () => ({ listSquad: (...args: unknown[]) => listSquad(...args) }))
vi.mock('../../api/clubApi', () => ({ getManagedClubProfile: (...args: unknown[]) => getManagedClubProfile(...args) }))
vi.mock('../../api/sponsorApi', () => ({ listSponsors: (...args: unknown[]) => listSponsors(...args) }))

const member = (first: string, last: string, patch: Record<string, unknown> = {}) => ({ playerProfileId: `${first}-${last}`, firstName: first, lastName: last, active: true, isCaptain: false, isWicketKeeper: false, squadJerseyNumber: null, jerseyNumber: null, photoUrl: null, gender: null, ...patch })
const team = { id: 't1', clubId: 'club-1', sectionId: 's1', name: 'Irene Veterans', logoUrl: null, affiliationLogoUrl: '/media/aff.png', affiliationName: 'Titans' } as never

function renderDialog() {
  return render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ShareSquadDialog open onClose={vi.fn()} clubId="club-1" team={team} seasonId="season-1" seasonLabel="2026/2027" />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // The squad poster also draws circles (round player pictures), which the shared canvas stub has no arc for.
  Object.assign(mockCanvas(), { arc: vi.fn() })
  listSquad.mockResolvedValue([member('Jaco', 'Van der Westhuizen', { squadJerseyNumber: 16 }), member('Andre', 'Botha', { isCaptain: true })])
  getManagedClubProfile.mockResolvedValue({ name: 'Irene Villagers', logoUrl: '/media/club.png', website: 'https://irene.example' })
  listSponsors.mockResolvedValue([])
})

describe('ShareSquadDialog', () => {
  it('opens the picture screen with the same options as the other picture templates, and no League logo switch', async () => {
    renderDialog()

    expect(await screen.findByText('Squad Poster')).toBeInTheDocument()
    for (const name of ['Grid', 'List', 'Club Green', 'Night', 'Daylight', 'Square 1080', 'Portrait 4:5', 'Story 9:16', 'Auto', 'Large', 'Larger', 'Largest']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    for (const label of ['Player Pictures', 'Shirt Numbers', 'Captain And Keeper Marks', 'First Names As Initials', 'Club logo', 'Team logos', 'Team affiliation logo']) {
      expect(screen.getByRole('checkbox', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryByRole('checkbox', { name: 'League logo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'League affiliation logo' })).not.toBeInTheDocument()
  })

  it('reads the squad of the team for the season, and offers Download PNG with the other sizes under its caret', async () => {
    renderDialog()
    await waitFor(() => expect(listSquad).toHaveBeenCalledWith('club-1', 't1', 'season-1'))

    // The caret appears once the picture has been made (until then Download PNG is a plain disabled button).
    await userEvent.click(await screen.findByRole('button', { name: 'More options for Download PNG' }))
    expect(screen.getByRole('menuitem', { name: 'Download Portrait 4:5' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Download Story 9:16' })).toBeInTheDocument()
  })

  it('says so when the squad cannot be loaded', async () => {
    listSquad.mockRejectedValue(new Error('boom'))
    renderDialog()
    expect(await screen.findByRole('alert')).toHaveTextContent('The squad could not be loaded')
  })

  it('has an editable heading, SQUAD to begin with, remembered for next time', async () => {
    renderDialog()
    const field = await screen.findByRole('textbox', { name: 'Heading' })
    expect(field).toHaveValue('SQUAD')
    await userEvent.clear(field)
    await userEvent.type(field, 'VCASA Club Champs')
    expect(JSON.parse(localStorage.getItem('squadShare:heading:club-1') as string)).toBe('VCASA Club Champs')
  })

  it('remembers the layout for next time', async () => {
    renderDialog()
    await userEvent.click(await screen.findByRole('button', { name: 'List' }))
    expect(JSON.parse(localStorage.getItem('squadShare:layout:club-1') as string)).toBe('LIST')
  })
})
