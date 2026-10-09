import { ThemeProvider } from '@mui/material'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PlayerCard } from './PlayerCard'
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

function renderCard(props: Partial<Parameters<typeof PlayerCard>[0]> = {}) {
  const onStatusAction = vi.fn()
  render(
    <ThemeProvider theme={baseTheme}>
      <MemoryRouter>
        <PlayerCard
          player={makePlayer()}
          sectionNames={[]}
          viewTo="/manage/players/player-1"
          editTo="/manage/players/player-1/edit"
          onStatusAction={onStatusAction}
          {...props}
        />
      </MemoryRouter>
    </ThemeProvider>,
  )
  return { onStatusAction }
}

const ROWS = ['Number', 'Born', 'Phone', 'Bat', 'Bowl']

// docs/specs/088-players-polls-alignment.md
describe('PlayerCard', () => {
  it('renders the title as a heading linking to viewTo, with Edit and View as footer links', () => {
    renderCard({ player: makePlayer({ firstName: 'Sipho', lastName: 'Ndlovu' }) })

    expect(screen.getByRole('heading', { name: 'Sipho Ndlovu' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sipho Ndlovu' })).toHaveAttribute('href', '/manage/players/player-1')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/players/player-1/edit')
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/manage/players/player-1')
  })

  it('clamps a long title to two lines so it always fits beside the avatar', () => {
    renderCard({ player: makePlayer({ firstName: 'Christopher Alexander', lastName: 'Montgomery-Hendricks the Third' }) })

    const heading = screen.getByRole('heading', { name: /Christopher Alexander/ })
    expect(getComputedStyle(heading).webkitLineClamp || heading.style.webkitLineClamp || getComputedStyle(heading).getPropertyValue('-webkit-line-clamp')).toBeTruthy()
  })

  describe('status badge and sections', () => {
    it.each([
      [{ verificationStatus: 'VERIFIED' as const, active: true }, 'Verified'],
      [{ verificationStatus: 'UNVERIFIED' as const, active: true }, 'Unverified'],
      [{ verificationStatus: 'REJECTED' as const, active: true }, 'Rejected'],
      [{ verificationStatus: 'VERIFIED' as const, active: false }, 'Suspended'],
    ])('shows %j as the first badge, labelled %s', (overrides, label) => {
      renderCard({ player: makePlayer(overrides), sectionNames: ['Vets'] })

      const badges = screen.getByTestId('player-status-badge').parentElement as HTMLElement
      expect(badges.firstElementChild).toHaveTextContent(label)
      expect(within(badges).getByText('Vets')).toBeInTheDocument()
    })

    it('a suspended player shows Suspended whatever their verification status is', () => {
      renderCard({ player: makePlayer({ active: false, verificationStatus: 'UNVERIFIED' }) })

      expect(screen.getByTestId('player-status-badge')).toHaveTextContent('Suspended')
    })

    it('shows the first section plus a +N overflow chip, or a dashed "No section"', () => {
      const { unmount } = render(
        <ThemeProvider theme={baseTheme}>
          <MemoryRouter>
            <PlayerCard
              player={makePlayer()}
              sectionNames={['Vets', 'Over 40', 'Social']}
              viewTo="/p"
              editTo="/p/edit"
              onStatusAction={vi.fn()}
            />
          </MemoryRouter>
        </ThemeProvider>,
      )
      expect(screen.getByText('Vets')).toBeInTheDocument()
      expect(screen.getByText('+2')).toBeInTheDocument()
      expect(screen.queryByText('Over 40')).not.toBeInTheDocument()
      unmount()

      renderCard({ sectionNames: [] })
      expect(screen.getByText('No section')).toBeInTheDocument()
    })
  })

  describe('the five fixed rows', () => {
    it('shows Number, Born, Phone, Bat and Bowl with their values', () => {
      renderCard({
        player: makePlayer({
          jerseyNumber: 7,
          dateOfBirth: '1978-08-19',
          phone: '083 555 0177',
          battingStance: 'LEFT_HANDED',
          bowlingArm: 'RIGHT_ARM',
          bowlingType: 'MEDIUM',
        }),
      })

      const rows = screen.getAllByTestId('player-detail-row')
      expect(rows.map((row) => row.textContent)).toEqual([
        'Number#7',
        'Born19 Aug 1978',
        'Phone083 555 0177',
        'BatLeft-handed',
        'BowlRight-arm, Medium',
      ])
    })

    it('shows "–" for everything that is not on file, so the card keeps the same rows', () => {
      renderCard({ player: makePlayer({ dateOfBirth: null }) })

      const rows = screen.getAllByTestId('player-detail-row')
      expect(rows.map((row) => row.textContent)).toEqual(ROWS.map((label) => `${label}–`))
    })

    it('has exactly the same rows whether or not anything is on file', () => {
      renderCard({ player: makePlayer({ phone: '082', jerseyNumber: 1, battingStance: 'RIGHT_HANDED' }) })
      const full = screen.getAllByTestId('player-detail-row').length
      document.body.innerHTML = ''
      renderCard({ player: makePlayer({ dateOfBirth: null }) })

      expect(screen.getAllByTestId('player-detail-row')).toHaveLength(full)
      expect(full).toBe(5)
    })

    it('tints the first, third and fifth rows with the shared zebra tint and leaves the others plain', () => {
      renderCard()

      const tint = zebraTint(baseTheme)
      const rows = screen.getAllByTestId('player-detail-row')
      expect(rows[0]).toHaveStyle({ backgroundColor: tint })
      expect(rows[2]).toHaveStyle({ backgroundColor: tint })
      expect(rows[4]).toHaveStyle({ backgroundColor: tint })
      expect(rows[1]).not.toHaveStyle({ backgroundColor: tint })
    })
  })

  describe('footer and the Status menu', () => {
    it.each([
      [{ verificationStatus: 'VERIFIED' as const, active: true }],
      [{ verificationStatus: 'UNVERIFIED' as const, active: true }],
      [{ verificationStatus: 'REJECTED' as const, active: true }],
      [{ verificationStatus: 'VERIFIED' as const, active: false }],
    ])('has the same three footer buttons, Status, Edit and View, for %j', (overrides) => {
      renderCard({ player: makePlayer(overrides) })

      const names = [screen.getByRole('button', { name: 'Change status' }), screen.getByRole('link', { name: 'Edit' }), screen.getByRole('link', { name: 'View' })]
      expect(names.map((node) => node.textContent)).toEqual(['Status', 'Edit', 'View'])
    })

    it.each([
      [{ verificationStatus: 'UNVERIFIED' as const, active: true }, ['Verify', 'Reject']],
      [{ verificationStatus: 'VERIFIED' as const, active: true }, ['Suspend']],
      [{ verificationStatus: 'REJECTED' as const, active: true }, ['Verify']],
      [{ verificationStatus: 'VERIFIED' as const, active: false }, ['Reactivate']],
    ])('the Status button of %j offers %j', async (overrides, labels) => {
      renderCard({ player: makePlayer(overrides) })

      await userEvent.click(screen.getByRole('button', { name: 'Change status' }))

      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(labels)
    })

    it('reports the chosen change to the caller and closes the menu', async () => {
      const { onStatusAction } = renderCard({ player: makePlayer({ verificationStatus: 'UNVERIFIED' }) })

      await userEvent.click(screen.getByRole('button', { name: 'Change status' }))
      await userEvent.click(screen.getByRole('menuitem', { name: 'Verify' }))

      expect(onStatusAction).toHaveBeenCalledWith('verify')
    })
  })

  // docs/specs/088 (E): games played in the header's top-right corner
  describe('games played chips', () => {
    it('shows this season and overall, with accessible names', () => {
      renderCard({ player: makePlayer({ gamesThisSeason: 12, gamesOverall: 48 }) })

      const chips = screen.getByTestId('player-games-chips')
      expect(within(chips).getByLabelText('12 games this season')).toHaveTextContent('12 this season')
      expect(within(chips).getByLabelText('48 games overall')).toHaveTextContent('48 overall')
    })

    it('is always present, with 0 for a player who has not played, so every card keeps one height', () => {
      renderCard({ player: makePlayer({ gamesThisSeason: 0, gamesOverall: 0 }) })

      const chips = screen.getByTestId('player-games-chips')
      expect(within(chips).getByLabelText('0 games this season')).toBeInTheDocument()
      expect(within(chips).getByLabelText('0 games overall')).toBeInTheDocument()
    })

    it('stretches the two chips to one width inside a column with a shared minimum width', () => {
      renderCard({ player: makePlayer({ gamesThisSeason: 3, gamesOverall: 1204 }) })

      const chips = screen.getByTestId('player-games-chips')
      expect(chips).toHaveStyle({ minWidth: '104px' })
      expect(getComputedStyle(chips).alignItems).toBe('stretch')
      expect(chips.children).toHaveLength(2)
    })

    it('keeps the title beside the chips, clamped, for a long name', () => {
      renderCard({ player: makePlayer({ firstName: 'Christopher Alexander', lastName: 'Montgomery-Hendricks the Third', gamesOverall: 203 }) })

      expect(screen.getByRole('heading', { name: /Christopher Alexander/ })).toBeInTheDocument()
      expect(screen.getByLabelText('203 games overall')).toBeInTheDocument()
    })
  })
})

