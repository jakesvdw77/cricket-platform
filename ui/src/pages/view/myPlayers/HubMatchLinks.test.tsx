import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HubMatchLinks } from './HubMatchLinks'
import { LIVE_SCORE, STREAM } from '../../../test/hubMatchFixtures'

// Owner, 2026-11-12: a finished match keeps its Watch Stream and Online Scorecard links, new tab, https only.
describe('HubMatchLinks', () => {
  it('shows both links, each opening in a new tab with noopener', () => {
    render(<HubMatchLinks stream={STREAM} liveScore={LIVE_SCORE} />)

    const stream = screen.getByRole('link', { name: 'Watch Stream, opens in a new tab' })
    const score = screen.getByRole('link', { name: 'Online Scorecard, opens in a new tab' })
    expect(stream).toHaveAttribute('href', STREAM.url)
    expect(score).toHaveAttribute('href', LIVE_SCORE.url)
    for (const link of [stream, score]) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
    }
  })

  it('shows only the stream link when there is no score source', () => {
    render(<HubMatchLinks stream={STREAM} liveScore={null} />)

    expect(screen.getByTestId('stream-link')).toBeInTheDocument()
    expect(screen.queryByTestId('score-link')).not.toBeInTheDocument()
  })

  it('shows only the scorecard link when there is no stream', () => {
    render(<HubMatchLinks stream={null} liveScore={LIVE_SCORE} />)

    expect(screen.getByTestId('score-link')).toBeInTheDocument()
    expect(screen.queryByTestId('stream-link')).not.toBeInTheDocument()
  })

  it('draws nothing with neither link', () => {
    const { container } = render(<HubMatchLinks stream={null} liveScore={undefined} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('hides a link that is not https, and draws nothing when both are unsafe', () => {
    const { container, rerender } = render(<HubMatchLinks stream={{ ...STREAM, url: 'http://stream.example/1' }} liveScore={LIVE_SCORE} />)
    expect(screen.queryByTestId('stream-link')).not.toBeInTheDocument()
    expect(screen.getByTestId('score-link')).toBeInTheDocument()

    rerender(<HubMatchLinks stream={{ ...STREAM, url: 'javascript:alert(1)' }} liveScore={{ ...LIVE_SCORE, url: 'http://scores.example/1' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
