import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CardHeaderControls } from './cardHeaderSlot'
import { StatsCardShell } from './StatsCardShell'
import type { StatsCardShellProps } from './StatsCardShell'

// docs/specs/147 section 3 and Amendment 2 items 8 and 9: what every card has in common, driven by CardState.
const base: StatsCardShellProps = {
  title: 'Runs Scored',
  tag: 'HAVE',
  state: 'ready',
  scopeLabel: '2025/26 · U14 A',
  basis: { counted: 6, total: 7 },
  summary: 'Sam has scored 158 runs.',
  front: <p>front figure</p>,
  back: <p>back table</p>,
}
const shell = (props: Partial<StatsCardShellProps> = {}) => render(<StatsCardShell {...base} {...props} />)

describe('StatsCardShell, ready', () => {
  it('draws the title as the card heading, the scope, the honesty line and a flip hint', () => {
    shell()
    expect(screen.getByRole('heading', { level: 3, name: 'Runs Scored' })).toBeInTheDocument()
    expect(screen.getAllByTestId('stats-scope')[0]).toHaveTextContent('2025/26 · U14 A')
    expect(screen.getAllByTestId('stats-basis')[0]).toHaveTextContent('Based on 6 of 7 results')
    expect(screen.getByText('front figure')).toBeInTheDocument()
    expect(screen.getByText('back table')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Flip Runs Scored' })).toBeInTheDocument()
  })

  it('draws no HAVE, PARTLY or NOT CAPTURED chip (the tag is metadata only) and no data-missing cue', () => {
    shell()
    expect(screen.queryByTestId('stats-tag')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stats-data-cue')).not.toBeInTheDocument()
    expect(screen.getByTestId('stats-card')).toHaveAttribute('data-state', 'ready')
    expect(screen.getByTestId('stats-card')).toHaveAttribute('data-tag', 'HAVE')
  })

  it('names the card by its one-sentence summary for the flip button', () => {
    shell()
    expect(screen.getByRole('button', { name: 'Flip Runs Scored' })).toHaveAccessibleDescription('Sam has scored 158 runs.')
  })

  it('leaves the honesty line empty without a basis', () => {
    shell({ basis: null })
    for (const line of screen.getAllByTestId('stats-basis')) expect(line).toHaveTextContent('')
  })

  it('puts the front\'s header controls in the title row and not in the back', () => {
    shell({
      front: <><p>front figure</p><CardHeaderControls><button type="button">Season Filter</button></CardHeaderControls></>,
    })
    const slot = screen.getByTestId('stats-header-actions')
    expect(within(slot).getByRole('button', { name: 'Season Filter' })).toBeInTheDocument()
    expect(screen.getAllByTestId('stats-header-actions')).toHaveLength(1)
  })

  it('shows the expand button only when the grid supplies onExpand, handing back the button', async () => {
    const onExpand = vi.fn()
    const { rerender } = shell()
    expect(screen.queryByRole('button', { name: 'Expand Runs Scored' })).not.toBeInTheDocument()
    rerender(<StatsCardShell {...base} onExpand={onExpand} />)
    const expand = screen.getByRole('button', { name: 'Expand Runs Scored' })
    await userEvent.setup().click(expand)
    expect(onExpand).toHaveBeenCalledWith(expand)
  })
})

describe('StatsCardShell, partial', () => {
  it('says "Some data missing" quietly with the note as its tooltip, and prints the note on the back only', () => {
    shell({ state: 'partial', partialNote: 'Covers the newest 50 matches only.' })
    const card = screen.getByTestId('stats-card')
    expect(card).toHaveAttribute('data-state', 'partial')
    expect(card).toHaveAttribute('data-tag', 'PARTLY')
    const cue = screen.getAllByTestId('stats-data-cue')
    expect(cue.length).toBeGreaterThan(0)
    expect(cue[0]).toHaveTextContent('Some data missing')
    expect(cue[0]).toHaveAttribute('title', 'Covers the newest 50 matches only.')
    // The front carries no note line; the back prints the sentence.
    expect(screen.getAllByTestId('stats-partial-note')).toHaveLength(1)
    expect(within(screen.getByTestId('stats-card-flip-card-back')).getByTestId('stats-partial-note')).toHaveTextContent('Covers the newest 50 matches only.')
  })

  it('keeps the card flippable and its honesty line next to the cue', () => {
    shell({ state: 'partial' })
    expect(screen.getByRole('button', { name: 'Flip Runs Scored' })).toBeInTheDocument()
    expect(screen.getAllByTestId('stats-basis')[0]).toHaveTextContent('Based on 6 of 7 results')
  })
})

describe('StatsCardShell, empty and missing', () => {
  it('draws one non-flipping face with the empty line and no cue, keeping the title', () => {
    shell({ state: 'empty', emptyText: 'No innings yet.' })
    expect(screen.queryByRole('button', { name: /Flip/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('stats-state-text')).toHaveTextContent('No innings yet.')
    expect(screen.getByRole('heading', { name: 'Runs Scored' })).toBeInTheDocument()
    expect(screen.queryByTestId('stats-data-cue')).not.toBeInTheDocument()
    expect(screen.queryByText('front figure')).not.toBeInTheDocument()
    expect(screen.getByTestId('stats-card')).toHaveAttribute('data-state', 'empty')
  })

  it('renders nothing for a missing card that hides itself', () => {
    const { container } = shell({ state: 'missing', whenMissing: 'hide' })
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the not-captured text, never a figure, for a missing card that says so', () => {
    shell({ state: 'missing', whenMissing: 'notCaptured', missingText: 'The scorecard does not record this.' })
    const card = screen.getByTestId('stats-card')
    expect(card).toHaveAttribute('data-state', 'missing')
    expect(card).toHaveAttribute('data-tag', 'NOT_CAPTURED')
    expect(screen.getByTestId('stats-state-text')).toHaveTextContent('The scorecard does not record this.')
    expect(screen.getByTestId('stats-data-cue')).toHaveTextContent('Some data missing')
    expect(screen.queryByText('front figure')).not.toBeInTheDocument()
  })
})

describe('StatsCardShell, expanded', () => {
  it('shows the Front and the Back together with no flip, a Close button that takes focus', async () => {
    const onClose = vi.fn()
    shell({ expanded: true, onClose })
    expect(screen.queryByRole('button', { name: /^Flip/ })).not.toBeInTheDocument()
    expect(within(screen.getByTestId('stats-expanded-front')).getByText('front figure')).toBeInTheDocument()
    expect(within(screen.getByTestId('stats-expanded-back')).getByText('back table')).toBeInTheDocument()
    const close = screen.getByRole('button', { name: 'Close Runs Scored' })
    expect(close).toHaveFocus()
    await userEvent.setup().click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('prints the partial note on the expanded card and shows the card\'s own Expanded body instead when given', () => {
    const { rerender } = shell({ expanded: true, state: 'partial', partialNote: 'Covers the newest 50 matches only.' })
    expect(screen.getByTestId('stats-partial-note')).toHaveTextContent('Covers the newest 50 matches only.')
    rerender(<StatsCardShell {...base} expanded expandedBody={<p>custom expanded</p>} />)
    expect(screen.getByText('custom expanded')).toBeInTheDocument()
    expect(screen.queryByTestId('stats-expanded-front')).not.toBeInTheDocument()
  })
})
