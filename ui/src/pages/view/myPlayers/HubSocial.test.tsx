import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { MyClubInfo, MyTeamLinks } from '../../../api/meClubInfoApi'
import { HubSocial } from './HubSocial'
import { newQueryClient, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { makeClubInfo } from '../../../test/clubInfoFixtures'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
const http = api as unknown as ApiMock

// The Hub Social Media page: one link card per social page the club added; nothing embedded.
function renderSocial(info: MyClubInfo | Error, teamLinks: MyTeamLinks[] | Error = []) {
  routeApi(http, { 'GET /me/players/k1/club-info': info, 'GET /me/players/k1/team-links': teamLinks })
  return render(
    <QueryClientProvider client={newQueryClient()}>
      <HubSocial playerKey="k1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('HubSocial', () => {
  it('shows a card per social page with the network name, the host and a new tab link', async () => {
    renderSocial(
      makeClubInfo({
        links: {
          website: 'https://riverside.example',
          social: [
            { platform: 'facebook', url: 'https://www.facebook.com/riverside' },
            { platform: 'youtube', url: 'https://www.youtube.com/@riverside' },
          ],
        },
      }),
    )
    const cards = await screen.findAllByTestId('hub-social-card')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByText('Facebook')).toBeInTheDocument()
    expect(within(cards[0]).getByText('facebook.com')).toBeInTheDocument()
    expect(cards[0]).toHaveAttribute('href', 'https://www.facebook.com/riverside')
    expect(cards[0]).toHaveAttribute('target', '_blank')
    expect(cards[0].getAttribute('rel')).toContain('noopener')
    expect(within(cards[1]).getByText('YouTube')).toBeInTheDocument()
  })

  it('leaves the website to Club info and drops a link that is not https', async () => {
    renderSocial(makeClubInfo({ links: { website: 'https://riverside.example', social: [{ platform: 'instagram', url: 'http://insecure.example/x' }] } }))
    expect(await screen.findByText('The club has not added any social media pages yet.')).toBeInTheDocument()
    expect(screen.queryByTestId('hub-social-card')).not.toBeInTheDocument()
  })

  it('says so when the club switched its links off or added none', async () => {
    renderSocial(makeClubInfo({ links: null }))
    expect(await screen.findByText('The club has not added any social media pages yet.')).toBeInTheDocument()
  })

  it('offers Retry when the club info cannot be read', async () => {
    renderSocial(new Error('boom'))
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  // docs/specs/157: the links of the teams the player is in, after the club's own.
  it('shows a group per team the player is in, each under the team name, after the club group', async () => {
    renderSocial(makeClubInfo(), [
      { teamName: 'Irene Veterans', social: [{ platform: 'instagram', url: 'https://www.instagram.com/irene_vets' }] },
      { teamName: 'Irene Over 50', social: [{ platform: 'facebook', url: 'https://www.facebook.com/irene50' }, { platform: 'x', url: 'http://insecure.example/x' }] },
    ])
    const team = await screen.findAllByTestId('hub-social-team')
    expect(team).toHaveLength(2)
    expect(within(team[0]).getByRole('heading', { name: 'Irene Veterans' })).toBeInTheDocument()
    expect(within(team[0]).getByText('Instagram')).toBeInTheDocument()
    expect(within(team[1]).getAllByTestId('hub-social-card')).toHaveLength(1)
    const club = screen.getByTestId('hub-social-club')
    expect(within(club).getByRole('heading', { name: 'Riverside CC' })).toBeInTheDocument()
    expect(club.compareDocumentPosition(team[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows team links alone when the club has none, and no club heading without team groups', async () => {
    renderSocial(makeClubInfo({ links: null }), [{ teamName: 'Irene Veterans', social: [{ platform: 'facebook', url: 'https://www.facebook.com/irene' }] }])
    expect(await screen.findByTestId('hub-social-team')).toBeInTheDocument()
    expect(screen.queryByTestId('hub-social-club')).not.toBeInTheDocument()
    expect(screen.queryByText('The club has not added any social media pages yet.')).not.toBeInTheDocument()
  })

  it('keeps the club links when the team links cannot be read', async () => {
    renderSocial(makeClubInfo(), new Error('boom'))
    const cards = await screen.findAllByTestId('hub-social-card')
    expect(cards).toHaveLength(1)
    expect(screen.queryByTestId('hub-social-team')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Riverside CC' })).not.toBeInTheDocument()
  })
})
