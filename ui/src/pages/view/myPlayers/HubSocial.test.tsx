import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { MyClubInfo } from '../../../api/meClubInfoApi'
import { HubSocial } from './HubSocial'
import { newQueryClient, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { makeClubInfo } from '../../../test/clubInfoFixtures'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
const http = api as unknown as ApiMock

// The Hub Social Media page: one link card per social page the club added; nothing embedded.
function renderSocial(info: MyClubInfo | Error) {
  routeApi(http, { 'GET /me/players/k1/club-info': info })
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
})
