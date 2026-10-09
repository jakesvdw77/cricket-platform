import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
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
  it('shows the heading, the announced chip and the empty selection with a Select team link', () => {
    renderCard()
    expect(screen.getByRole('heading', { name: '1st XI · Home' })).toBeInTheDocument()
    expect(screen.getByText('Not announced')).toBeInTheDocument()
    expect(screen.getByText('No players selected yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Select team' })).toHaveAttribute('href', '/edit?tab=playing-xi')
    expect(screen.getByText('0 of 12 picked')).toBeInTheDocument()
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
