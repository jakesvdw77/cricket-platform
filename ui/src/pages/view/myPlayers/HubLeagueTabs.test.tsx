import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { HubLeagueConditions, HubLeagueDetails, HubLeagueFields, HubLeagueSocialLinks, HubLeagueTabBar, HubLeagueTeams } from './HubLeagueTabs'
import type { LeagueTab } from './leagueFormat'
import { conditions, hubField, leagueDto } from '../../../test/hubLeagueFixtures'

// docs/specs/123 and 124: the read-only Details, Playing conditions, Teams and Fields tabs, the tab row and the social links.
const tile = (label: string) => screen.getByText(label).nextSibling as HTMLElement

describe('HubLeagueTabBar', () => {
  function Harness({ onChange }: { onChange?: (tab: LeagueTab) => void }) {
    const [tab, setTab] = useState<LeagueTab>('details')
    return <HubLeagueTabBar value={tab} onChange={(next) => { setTab(next); onChange?.(next) }} />
  }

  it('has six tabs in order, with no Key dates tab, and selects Details', () => {
    render(<Harness />)

    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Details', 'Playing conditions', 'Teams', 'Schedule', 'Results', 'Fields'])
    expect(screen.queryByRole('tab', { name: 'Key dates' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
  })

  it('moves with the arrow keys, wrapping round, and reports the tab', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    screen.getByRole('tab', { name: 'Details' }).focus()

    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('fields')
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('details')
    await user.click(screen.getByRole('tab', { name: 'Teams' }))
    expect(onChange).toHaveBeenLastCalledWith('teams')
  })
})

describe('HubLeagueDetails', () => {
  it('shows the description, age group, format and the key dates as tiles', () => {
    render(<HubLeagueDetails dto={leagueDto()} />)

    expect(screen.getByText('Weekend cricket for juniors.')).toBeInTheDocument()
    expect(tile('Age group')).toHaveTextContent('Under 15')
    expect(tile('Format')).toHaveTextContent('T20')
    expect(tile('Season starts')).toHaveTextContent(/Thursday,? 1 October 2026/)
    expect(tile('Season ends')).toHaveTextContent(/Wednesday,? 31 March 2027/)
    expect(screen.getByText('First match')).toBeInTheDocument()
    expect(screen.getByText('Next match')).toBeInTheDocument()
    expect(screen.getByText('Last match')).toBeInTheDocument()
  })

  it('leaves out a key date that is not set, and says so when there is nothing at all', () => {
    const dto = leagueDto()
    const { unmount } = render(<HubLeagueDetails dto={{ ...dto, keyDates: { ...dto.keyDates, nextMatchDate: null, seasonEnd: null } }} />)
    expect(screen.queryByText('Next match')).not.toBeInTheDocument()
    expect(screen.queryByText('Season ends')).not.toBeInTheDocument()
    unmount()

    render(<HubLeagueDetails dto={{ ...dto, league: { ...dto.league, description: null, maxAge: null, format: null }, keyDates: { seasonStart: null, seasonEnd: null, firstMatchDate: null, lastMatchDate: null, nextMatchDate: null } }} />)
    expect(screen.getByText('No further details have been added for this league.')).toBeInTheDocument()
  })
})

describe('HubLeagueConditions', () => {
  const show = (c = conditions()) => render(<HubLeagueConditions dto={leagueDto({ playingConditions: c })} />)

  it('shows the structured facts as tiles', () => {
    show()

    expect(tile('Overs per innings')).toHaveTextContent('20')
    expect(tile('Powerplay overs')).toHaveTextContent('6')
    expect(tile('Max overs per bowler')).toHaveTextContent('4')
    expect(tile('Substitutions')).toHaveTextContent('Allowed')
    expect(tile('Win')).toHaveTextContent('4')
    expect(tile('Forfeit win')).toHaveTextContent('4')
  })

  it('shows Balls per over as no limit or the limit, and Free hit as Yes or No (spec 124)', () => {
    const { unmount } = show()
    expect(tile('Balls per over')).toHaveTextContent('No limit')
    expect(tile('Free hit after a no ball')).toHaveTextContent('Yes')
    unmount()

    show(conditions({ maxBallsPerOver: 8, freeHitOnNoBall: false }))
    expect(tile('Balls per over')).toHaveTextContent('At most 8, wides and no balls included')
    expect(tile('Free hit after a no ball')).toHaveTextContent('No')
  })

  it('shows the Bonus point tile as 1 when bonus points apply, with the rule line', () => {
    show(conditions({ bonusPointsEnabled: true, bonusBattingOversThreshold: 17, bonusBowlingRestrictionPercentage: 80 }))

    expect(tile('Bonus point')).toHaveTextContent('1')
    expect(screen.getByText(/chase the target before over 17, or restrict the opposition to 80%/)).toBeInTheDocument()
  })

  it('shows the Bonus point tile as 0 when the league scores points but has no bonus', () => {
    show()
    expect(tile('Bonus point')).toHaveTextContent('0')
  })

  it('hides the Bonus point tile when no points are set at all', () => {
    show(conditions({ pointsForWin: null as never, pointsForLoss: null as never, pointsForDraw: null as never, pointsForNoResult: null as never, pointsForForfeitWin: null as never }))
    expect(screen.queryByText('Bonus point')).not.toBeInTheDocument()
  })

  it('hides Balls per over, Free hit and Substitutions on a PDF-only record', () => {
    show(conditions({ maxOversPerInnings: null as never, allowSubstitutions: false, documentUrl: 'https://example.com/pc.pdf' }))

    expect(screen.queryByText('Balls per over')).not.toBeInTheDocument()
    expect(screen.queryByText('Free hit after a no ball')).not.toBeInTheDocument()
    expect(screen.queryByText('Substitutions')).not.toBeInTheDocument()
  })

  it('links the PDF only when it is https, and shows notes', () => {
    const { unmount } = show(conditions({ documentUrl: 'https://example.com/pc.pdf', additionalNotes: 'DLS applies.' }))
    expect(screen.getByRole('link', { name: 'Open PDF' })).toHaveAttribute('href', 'https://example.com/pc.pdf')
    expect(screen.getByText('DLS applies.')).toBeInTheDocument()
    unmount()

    show(conditions({ documentUrl: 'http://example.com/pc.pdf' }))
    expect(screen.queryByRole('link', { name: 'Open PDF' })).not.toBeInTheDocument()
  })

  it('has an empty line when none are set', () => {
    render(<HubLeagueConditions dto={leagueDto({ playingConditions: null })} />)
    expect(screen.getByText('No playing conditions set for this season yet.')).toBeInTheDocument()
  })
})

describe('HubLeagueTeams', () => {
  it('lists every team and tags the player\'s own', () => {
    render(<HubLeagueTeams dto={leagueDto()} />)

    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getAllByText('Your team')).toHaveLength(1)
    expect(within(screen.getAllByRole('article')[0]).getByText('Your team')).toBeInTheDocument()
  })

  it('has an empty line', () => {
    render(<HubLeagueTeams dto={leagueDto({ teams: [] })} />)
    expect(screen.getByText('No teams entered yet.')).toBeInTheDocument()
  })
})

describe('HubLeagueFields', () => {
  it('shows a card per field the league uses', () => {
    render(<HubLeagueFields dto={leagueDto({ fields: [hubField(), hubField({ id: 'f2', name: 'Hillcrest Park' })] })} />)

    expect(screen.getByRole('heading', { name: 'Riverside Oval' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hillcrest Park' })).toBeInTheDocument()
  })

  it('has the empty line, also when the server sent no fields key', () => {
    const { unmount } = render(<HubLeagueFields dto={leagueDto({ fields: [] })} />)
    expect(screen.getByText('No fields for this league yet')).toBeInTheDocument()
    unmount()

    render(<HubLeagueFields dto={leagueDto({ fields: undefined as never })} />)
    expect(screen.getByText('No fields for this league yet')).toBeInTheDocument()
  })
})

describe('HubLeagueSocialLinks', () => {
  const league = (website: string | null, links: { platform: string; url: string }[]) => ({ ...leagueDto().league, website, socialLinks: links as never })

  it('shows icon-only links, labelled by the host and opening in a new tab', () => {
    render(<HubLeagueSocialLinks league={league('https://league.example', [{ platform: 'facebook', url: 'https://www.facebook.com/boland' }, { platform: 'instagram', url: 'https://instagram.com/boland' }, { platform: 'other', url: 'https://club.example/x' }])} />)

    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual([
      'Website (opens in a new tab)', 'Facebook (opens in a new tab)', 'Instagram (opens in a new tab)', 'Other (opens in a new tab)',
    ])
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
      expect(link).toHaveTextContent('')
    }
    expect(links[1]).toHaveAttribute('href', 'https://www.facebook.com/boland')
  })

  it('takes the icon from the host, not from the stored platform name', () => {
    render(<HubLeagueSocialLinks league={league(null, [{ platform: 'misc', url: 'https://youtu.be/abc' }])} />)
    expect(screen.getByRole('link', { name: 'YouTube (opens in a new tab)' }).querySelector('[data-testid="YouTubeIcon"]')).not.toBeNull()
  })

  it('drops links that are not https and renders nothing when none are left', () => {
    const { container } = render(<HubLeagueSocialLinks league={league('http://league.example', [{ platform: 'facebook', url: 'javascript:alert(1)' }])} />)
    expect(container).toBeEmptyDOMElement()
  })
})
