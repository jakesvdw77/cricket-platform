import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { MatchTeamCard } from './MatchTeamCard'
import type { MatchSide } from '../../../api/matchSideApi'

const side = (overrides: Partial<MatchSide> = {}): MatchSide => ({
  id: 's1',
  matchId: 'm1',
  teamId: 't1',
  captainPlayerId: null,
  wicketKeeperPlayerId: null,
  twelfthManPlayerId: null,
  players: [],
  announced: false,
  limits: { battingPlaces: 11, twelfthManAllowed: true, maxSelected: 12 },
  ...overrides,
})

function renderCard(props: Partial<Parameters<typeof MatchTeamCard>[0]> = {}) {
  return render(
    <MemoryRouter>
      <MatchTeamCard
        testId="card"
        teamName="1st XI"
        sideLabel="Home"
        side={side()}
        squad={[]}
        announced={false}
        announcedReady
        sidesReady
        playingXiSize={12}
        selectTo="/edit?tab=playing-xi"
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('MatchTeamCard', () => {
  it('shows the heading, the announced chip and the empty selection', () => {
    renderCard()
    expect(screen.getByRole('heading', { name: '1st XI · Home' })).toBeInTheDocument()
    expect(screen.getByText('Not announced')).toBeInTheDocument()
    expect(screen.getByText('No players selected yet.')).toBeInTheDocument()
    expect(screen.getByText('0 of 12 picked')).toBeInTheDocument()
  })

  // docs/specs/130: the team actions are text-only outlined buttons in the panel's header row, whatever the selection.
  it('has one Select Team link in the header row, empty selection or not', () => {
    renderCard()
    expect(screen.getAllByRole('link', { name: 'Select Team' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Select Team' })).toHaveAttribute('href', '/edit?tab=playing-xi')
    expect(screen.getByRole('group', { name: 'Team actions' })).toContainElement(screen.getByRole('link', { name: 'Select Team' }))
    // Header row, before the Playing XI block: nothing is left at the foot of the panel.
    const group = screen.getByRole('group', { name: 'Team actions' })
    expect(group.compareDocumentPosition(screen.getByText('Playing XI')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows Share Team Sheet only when it is given a handler, carrying the share icon, and calls it', async () => {
    const onShare = vi.fn()
    const { unmount } = renderCard()
    expect(screen.queryByRole('button', { name: /share team sheet/i })).not.toBeInTheDocument()
    unmount()

    renderCard({ onShare })
    const button = screen.getByRole('button', { name: 'Share team sheet for 1st XI' })
    expect(button).toHaveTextContent('Share Team Sheet')
    expect(button.querySelector('svg')).not.toBeNull()
    // Select Team is text only.
    expect(screen.getByRole('link', { name: 'Select Team' }).querySelector('svg')).toBeNull()
    await userEvent.setup().click(button)
    expect(onShare).toHaveBeenCalledTimes(1)
  })

  it('is a flat panel: a hairline and no shadow', () => {
    renderCard()
    const panel = screen.getByTestId('card')
    expect(getComputedStyle(panel).boxShadow).toBe('none')
  })

  it('shows the picked count and no bar for a match with no league', () => {
    renderCard({ playingXiSize: null, announced: true })
    expect(screen.getByText('0 picked')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText('Announced')).toBeInTheDocument()
  })

  it('hides the selection until the sides have loaded', () => {
    renderCard({ sidesReady: false, announcedReady: false })
    expect(screen.queryByText('Playing XI')).not.toBeInTheDocument()
    expect(screen.queryByText('Not announced')).not.toBeInTheDocument()
  })
})
