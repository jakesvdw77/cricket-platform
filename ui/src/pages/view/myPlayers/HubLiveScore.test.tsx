import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LiveScoreSource } from '../../../api/myPlayersApi'
import { HubLiveScore } from './HubLiveScore'
import { LIVE_SCORE } from '../../../test/hubMatchFixtures'

// docs/specs/135 (The LiveScore seam): the one component that reads the source. EXTERNAL opens a new tab, never framed.
describe('HubLiveScore', () => {
  it('renders the Follow Live Score link in a new tab with noopener, in each variant', () => {
    for (const variant of ['row', 'card', 'tv'] as const) {
      const { unmount } = render(<HubLiveScore source={LIVE_SCORE} variant={variant} owner={{ name: 'Riverside Cricket Club' }} />)
      const link = screen.getByRole('link', { name: 'Follow Live Score' })
      expect(link).toHaveAttribute('href', LIVE_SCORE.url)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
      expect(link.getAttribute('rel')).toContain('noreferrer')
      expect(document.querySelector('iframe')).toBeNull()
      unmount()
    }
  })

  it('says where the scores are kept on the card and tv variants, and the club on the card', () => {
    const { unmount } = render(<HubLiveScore source={LIVE_SCORE} variant="card" owner={{ name: 'Riverside Cricket Club' }} />)
    expect(screen.getByText('Riverside Cricket Club')).toBeInTheDocument()
    expect(screen.getByText('Scores are kept on scores.example. It opens in a new tab.')).toBeInTheDocument()
    unmount()
    render(<HubLiveScore source={LIVE_SCORE} variant="tv" />)
    expect(screen.getByText('Scores are kept on scores.example.')).toBeInTheDocument()
  })

  it('shows nothing for no source, an unknown kind or a link that is not https', () => {
    const { container, rerender } = render(<HubLiveScore source={null} variant="row" />)
    expect(container).toBeEmptyDOMElement()
    rerender(<HubLiveScore source={{ kind: 'NATIVE' } as unknown as LiveScoreSource} variant="row" />)
    expect(container).toBeEmptyDOMElement()
    rerender(<HubLiveScore source={{ ...LIVE_SCORE, url: 'javascript:alert(1)' }} variant="row" />)
    expect(container).toBeEmptyDOMElement()
    rerender(<HubLiveScore source={{ ...LIVE_SCORE, url: 'http://scores.example/1' }} variant="card" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('the seam is contained', () => {
  const files = readdirSync(__dirname).filter((name) => /\.tsx?$/.test(name) && !/\.test\./.test(name))

  it('lets only HubLiveScore read the live-score link', () => {
    const readers = files.filter((name) => /liveScore\??\.url|source\.url/.test(readFileSync(join(__dirname, name), 'utf8')))
    expect(readers).toEqual(['HubLiveScore.tsx'])
  })

  it('lets only HubWatchLive render an iframe', () => {
    const frames = files.filter((name) => /<iframe|component="iframe"/.test(readFileSync(join(__dirname, name), 'utf8')))
    expect(frames).toEqual(['HubWatchLive.tsx'])
  })
})
