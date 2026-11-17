import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatchLogoPair } from './MatchLogoPair'
import { makeMatch, makeTeam } from './matchTestUtils'

// Both sides of a match as two logos, home then away: a club team's own logo, an opponent's copied logo, else the initials.
describe('MatchLogoPair', () => {
  const ours = { ...makeTeam('team-1', 'Irene Veterans'), abbreviation: 'IV', logoUrl: '/media/irene.png' }
  const teamsById = new Map([[ours.id, ours]])

  it('shows the club team\'s own logo and an opponent\'s copied logo, home first', () => {
    render(<MatchLogoPair match={makeMatch({ homeTeamId: 'team-1', awayTeamId: null, awayTeamName: 'Delta CC', awayTeamLogoUrl: '/media/delta.png' })} teamsById={teamsById} />)
    expect(screen.getByTestId('match-logo-home').querySelector('img')?.getAttribute('src')).toBe('/media/irene.png')
    expect(screen.getByTestId('match-logo-away').querySelector('img')?.getAttribute('src')).toBe('/media/delta.png')
    expect(screen.getByTestId('match-logo-pair').firstElementChild).toBe(screen.getByTestId('match-logo-home'))
  })

  it('shows the initials for a side with no logo, the abbreviation for a club team and the name\'s initials for an opponent', () => {
    render(<MatchLogoPair match={makeMatch({ homeTeamId: 'team-1', awayTeamId: null, awayTeamName: 'Midlands CC', awayTeamLogoUrl: null })} teamsById={new Map([[ours.id, { ...ours, logoUrl: null }]])} />)
    expect(screen.getByTestId('match-logo-home')).toHaveTextContent('IV')
    expect(screen.getByTestId('match-logo-away')).toHaveTextContent('MC')
    expect(screen.getByTestId('match-logo-away').querySelector('img')).toBeNull()
  })

  it('shows the away club team\'s logo when both sides are club teams (a derby)', () => {
    const other = { ...makeTeam('team-2', 'Irene Over 50'), logoUrl: '/media/o50.png' }
    render(<MatchLogoPair match={makeMatch({ homeTeamId: 'team-1', awayTeamId: 'team-2' })} teamsById={new Map([[ours.id, ours], [other.id, other]])} />)
    expect(screen.getByTestId('match-logo-away').querySelector('img')?.getAttribute('src')).toBe('/media/o50.png')
  })
})
