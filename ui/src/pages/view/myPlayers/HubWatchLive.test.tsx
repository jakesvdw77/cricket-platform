import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { MyMatchDto } from '../../../api/myPlayersApi'
import { HubWatchLive } from './HubWatchLive'
import { httpError, newQueryClient, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { LIVE_SCORE, STREAM, matchDto } from '../../../test/hubMatchFixtures'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/135 (Watch Live): TV surround, scoreboard strip, click to play first, graceful Open Stream fallback.
const http = api as unknown as ApiMock

const live = (overrides: Partial<MyMatchDto> = {}) => matchDto({ phase: 'LIVE', startedAt: new Date().toISOString(), liveScore: LIVE_SCORE, stream: STREAM, ...overrides })

function renderWatch(data: MyMatchDto | Error) {
  routeApi(http, { 'GET /me/players/k1/matches/m1': data })
  return render(
    <QueryClientProvider client={newQueryClient()}>
      <MemoryRouter>
        <HubWatchLive playerKey="k1" matchId="m1" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('HubWatchLive', () => {
  it('shows the scoreboard strip with the LIVE badge, league and venue, and a poster with no iframe before the tap', async () => {
    renderWatch(live())

    const strip = await screen.findByTestId('watch-scoreboard')
    expect(strip).toHaveTextContent('Riverside U15 A')
    expect(strip).toHaveTextContent('versus')
    expect(strip).toHaveTextContent('Coastal U15')
    expect(strip).toHaveTextContent('TVL Division 1 · Riverside Oval')
    expect(within(strip).getByTestId('live-badge')).toBeInTheDocument()
    const poster = screen.getByTestId('stream-poster')
    expect(poster).toHaveTextContent('Tap To Watch')
    expect(poster).toHaveTextContent('YouTube')
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('loads the server\'s embed URL in a sandboxed iframe only after the tap', async () => {
    renderWatch(live())

    await userEvent.setup().click(await screen.findByTestId('stream-poster'))
    const frame = screen.getByTestId('stream-frame')
    expect(frame).toHaveAttribute('src', STREAM.embedUrl)
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation')
    expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    expect(frame).toHaveAttribute('allow', 'autoplay; fullscreen; picture-in-picture')
    expect(frame).toHaveAttribute('loading', 'lazy')
    expect(frame).toHaveAttribute('title', 'Riverside U15 A versus Coastal U15')
    expect(frame.hasAttribute('allowfullscreen')).toBe(true)
    expect(frame.getAttribute('sandbox')).not.toMatch(/top-navigation|popups/)
    expect(screen.queryByTestId('stream-poster')).not.toBeInTheDocument()
  })

  it('puts the LiveScore tv panel under the frame and Open Stream as the always-there fallback', async () => {
    renderWatch(live())

    await screen.findByTestId('stream-poster')
    expect(within(screen.getByTestId('live-score-tv')).getByRole('link', { name: 'Follow Live Score' })).toHaveAttribute('target', '_blank')
    const open = screen.getByTestId('open-stream')
    expect(open).toHaveAttribute('href', STREAM.url)
    expect(open).toHaveAttribute('target', '_blank')
    expect(open.getAttribute('rel')).toContain('noopener')
    expect(screen.getByText('Not loading? Open the stream in a new tab.')).toBeInTheDocument()
  })

  it('falls back to Open Stream and embeds nothing when there is no embed URL', async () => {
    renderWatch(live({ stream: { url: 'https://live.example.com/watch/9', provider: 'OTHER', embedUrl: null } }))

    const fallback = await screen.findByTestId('stream-fallback')
    expect(fallback).toHaveTextContent('This stream opens on live.example.com')
    expect(within(fallback).getByTestId('open-stream')).toHaveAttribute('href', 'https://live.example.com/watch/9')
    expect(screen.queryByTestId('stream-poster')).not.toBeInTheDocument()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('says the stream is not on when the match is not live or has no stream', async () => {
    const { unmount } = renderWatch(matchDto({ phase: 'UPCOMING', stream: null }))
    expect(await screen.findByTestId('hub-watch-off')).toHaveTextContent('The stream is not on right now')
    unmount()

    renderWatch(live({ stream: null }))
    expect(await screen.findByTestId('hub-watch-off')).toBeInTheDocument()
  })

  it('says This match is not available for a 404', async () => {
    renderWatch(httpError(404))

    expect(await screen.findByTestId('hub-match-missing')).toBeInTheDocument()
  })
})
