import { ThemeProvider } from '@mui/material'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PlayerTable } from './PlayerTable'
import type { Player } from '../../api/playerApi'
import { baseTheme } from '../../theme'
import { zebraTint } from '../../utils/zebraTint'

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    personId: 'person-1',
    clubId: 'test-club-id',
    firstName: 'Sipho',
    lastName: 'Ndlovu',
    dateOfBirth: '2010-04-12',
    gender: 'MALE',
    photoUrl: null,
    clubMembershipNumber: 'RCC-042',
    medicalAidProvider: null,
    medicalAidMemberNumber: null,
    phone: null,
    email: null,
    altContactName: null,
    altContactPhone: null,
    battingStance: null,
    bowlingArm: null,
    bowlingType: null,
    isWicketKeeper: false,
    active: true,
    sectionIds: [],
    jerseyNumber: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    verificationStatus: 'VERIFIED',
    gamesThisSeason: 0,
    gamesOverall: 0,
    ...overrides,
  }
}


function LocationProbe() {
  const location = useLocation()
  return <div>At: {location.pathname}</div>
}

function renderTable(players: Player[], sections: Record<string, string[]> = {}) {
  const onStatusAction = vi.fn()
  render(
    <ThemeProvider theme={baseTheme}>
      <MemoryRouter initialEntries={['/list']}>
        <Routes>
          <Route
            path="/list"
            element={
              <PlayerTable
                players={players}
                sectionNamesFor={(player) => sections[player.id] ?? []}
                viewTo={(player) => `/manage/players/${player.id}`}
                onStatusAction={onStatusAction}
              />
            }
          />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
  return { onStatusAction }
}

// docs/specs/088-players-polls-alignment.md (F)
describe('PlayerTable', () => {
  it('has a header row with every column and one row per player', () => {
    renderTable([makePlayer({ id: 'p1' }), makePlayer({ id: 'p2', firstName: 'Amy', lastName: 'Ansell' })])

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Player', 'Status', 'Section', 'No.', 'Phone', 'Bat', 'Bowl', 'Season', 'Overall', '',
    ])
    expect(screen.getAllByTestId('player-row')).toHaveLength(2)
    expect(screen.getByRole('table', { name: 'Players' })).toBeInTheDocument()
  })

  it('a phone shows Player, Season, Phone and the button: Status, Section, No., Bat, Bowl and Overall are the desktop-only columns', () => {
    renderTable([makePlayer({ id: 'p1', phone: '083 555 0177', gamesThisSeason: 5, gamesOverall: 22 })])

    const headers = screen.getAllByRole('columnheader')
    const desktopOnly = headers.filter((header) => header.hasAttribute('data-desktop-only')).map((header) => header.textContent)
    const kept = headers.filter((header) => !header.hasAttribute('data-desktop-only')).map((header) => header.textContent)
    expect(desktopOnly).toEqual(['Status', 'Section', 'No.', 'Bat', 'Bowl', 'Overall'])
    expect(kept).toEqual(['Player', 'Phone', 'Season', ''])

    // the cells follow the same split, and Season is ordered before Phone on a phone
    const [row] = screen.getAllByTestId('player-row')
    const cells = within(row).getAllByRole('cell')
    expect(cells.filter((cell) => cell.hasAttribute('data-desktop-only'))).toHaveLength(6)
    expect(cells[4]).not.toHaveAttribute('data-desktop-only') // Phone
    expect(cells[4]).toHaveTextContent('083 555 0177')
    expect(cells[7]).not.toHaveAttribute('data-desktop-only') // Season
    expect(cells[8]).toHaveAttribute('data-desktop-only') // Overall
  })

  it('keeps the header sticky and every row the same height with the same ten cells', () => {
    renderTable([makePlayer({ id: 'p1' }), makePlayer({ id: 'p2', phone: '082', jerseyNumber: 4 })])

    expect(screen.getAllByRole('columnheader')[0].parentElement).toHaveStyle({ position: 'sticky', top: '0px' })
    for (const row of screen.getAllByTestId('player-row')) {
      expect(within(row).getAllByRole('cell')).toHaveLength(10)
    }
  })

  it('shows the values, and "–" for everything that is not on file', () => {
    renderTable(
      [
        makePlayer({ id: 'p1', jerseyNumber: 7, phone: '083 555 0177', battingStance: 'LEFT_HANDED', bowlingArm: 'RIGHT_ARM', bowlingType: 'MEDIUM', gamesThisSeason: 12, gamesOverall: 48 }),
        makePlayer({ id: 'p2', firstName: 'Sam', lastName: 'Peters' }),
      ],
      { p1: ['Vets', 'Over 40'] },
    )

    const [full, empty] = screen.getAllByTestId('player-row')
    expect(within(full).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      // the first cell also holds the badge a phone shows under the name (hidden from `sm` up by CSS)
      'Sipho NdlovuVerified', 'Verified', 'Vets +1', '#7', '083 555 0177', 'Left-handed', 'Right-arm, Medium', '12', '48', '',
    ])
    expect(within(empty).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Sam PetersVerified', 'Verified', 'No section', '–', '–', '–', '–', '0', '0', '',
    ])
  })

  it('shows the status badge for every status, Suspended winning over the verification status', () => {
    renderTable([
      makePlayer({ id: 'a', verificationStatus: 'VERIFIED' }),
      makePlayer({ id: 'b', verificationStatus: 'UNVERIFIED' }),
      makePlayer({ id: 'c', verificationStatus: 'REJECTED' }),
      makePlayer({ id: 'd', active: false, verificationStatus: 'UNVERIFIED' }),
    ])

    expect(screen.getAllByTestId('player-status-badge-desktop').map((badge) => badge.textContent)).toEqual([
      'Verified', 'Unverified', 'Rejected', 'Suspended',
    ])
  })

  it('tints the first, third ... rows with the shared zebra tint and leaves the others plain', () => {
    renderTable([makePlayer({ id: 'a' }), makePlayer({ id: 'b' }), makePlayer({ id: 'c' })])

    const rows = screen.getAllByTestId('player-row')
    const tint = zebraTint(baseTheme)
    expect(rows[0]).toHaveStyle({ backgroundColor: tint })
    expect(rows[2]).toHaveStyle({ backgroundColor: tint })
    expect(rows[1]).not.toHaveStyle({ backgroundColor: tint })
  })

  describe('opening the player', () => {
    it('the name is a link to the player over a row that contains the whole click area', async () => {
      renderTable([makePlayer({ id: 'p9', firstName: 'Amy', lastName: 'Ansell' })])

      const link = screen.getByRole('link', { name: 'Amy Ansell' })
      expect(link).toHaveAttribute('href', '/manage/players/p9')
      // the stretched link's ::after resolves against the row, so the row is the positioned ancestor
      expect(screen.getByTestId('player-row')).toHaveStyle({ position: 'relative' })

      await userEvent.click(link)
      expect(await screen.findByText('At: /manage/players/p9')).toBeInTheDocument()
    })

    it('the Status button sits above the link and opens its menu without navigating', async () => {
      renderTable([makePlayer({ id: 'p9' })])

      const button = screen.getByRole('button', { name: 'Change status' })
      expect(button).toHaveStyle({ position: 'relative' })
      await userEvent.click(button)

      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Suspend'])
      expect(screen.queryByText(/^At:/)).not.toBeInTheDocument()
    })
  })

  describe('the Status menu', () => {
    it.each([
      [{ verificationStatus: 'UNVERIFIED' as const }, ['Verify', 'Reject']],
      [{ verificationStatus: 'VERIFIED' as const }, ['Suspend']],
      [{ verificationStatus: 'REJECTED' as const }, ['Verify']],
      [{ active: false }, ['Reactivate']],
    ])('a player with %j offers %j', async (overrides, labels) => {
      renderTable([makePlayer(overrides)])

      await userEvent.click(screen.getByRole('button', { name: 'Change status' }))

      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(labels)
    })

    it('reports the player and the chosen change to the caller', async () => {
      const players = [makePlayer({ id: 'a' }), makePlayer({ id: 'b', verificationStatus: 'UNVERIFIED' })]
      const { onStatusAction } = renderTable(players)

      await userEvent.click(screen.getAllByRole('button', { name: 'Change status' })[1])
      await userEvent.click(screen.getByRole('menuitem', { name: 'Reject' }))

      expect(onStatusAction).toHaveBeenCalledWith(players[1], 'reject')
    })
  })
})
