import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SlotMatches } from './SlotMatches'
import type { SectionAvailabilityRoundMatch } from '../../../../api/sectionAvailabilityApi'

function match(id: string, leagueName: string | null): SectionAvailabilityRoundMatch {
  return {
    matchId: id,
    teamId: 't1',
    teamName: 'Lions',
    opponentLabel: `Rivals ${id}`,
    matchDate: '2026-06-06T09:00:00Z',
    venue: null,
    leagueName,
    dayPart: 'MORNING',
    windowId: 'w1',
  }
}

describe('SlotMatches', () => {
  it('says so when the slot has no matches', () => {
    render(<SlotMatches matches={[]} />)

    expect(screen.getByText('No matches in this slot.')).toBeInTheDocument()
  })

  it('renders each match as match, date and time, league cells in one shared grid', () => {
    render(<SlotMatches matches={[match('a', 'Premier'), match('b', null)]} />)

    const grid = screen.getByTestId('slot-matches')
    const rows = within(grid).getAllByTestId('slot-match')
    expect(rows).toHaveLength(2)
    expect(rows[0].children).toHaveLength(3)
    expect(rows[0].children[0]).toHaveTextContent('Lions v Rivals a')
    expect(rows[0].children[2]).toHaveTextContent('Premier')
    // A line without a league leaves the third cell empty so the columns still line up.
    expect(rows[1].children[2]).toBeEmptyDOMElement()
    expect(getComputedStyle(grid).display).toBe('grid')
  })

  it('uses three columns from sm and a single stacked column on a phone', () => {
    render(<SlotMatches matches={[match('a', 'Premier')]} />)
    const grid = screen.getByTestId('slot-matches')
    const css = Array.from(document.querySelectorAll('style'))
      .flatMap((style) => Array.from(style.sheet?.cssRules ?? []))
      .map((rule) => rule.cssText)
      .filter((text) => Array.from(grid.classList).some((name) => text.includes(`.${name}`)))
      .join('\n')

    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
    expect(css).toMatch(/@media \(min-width:\s*600px\)[^]*max-content max-content/)
    const rowCss = Array.from(document.querySelectorAll('style'))
      .flatMap((style) => Array.from(style.sheet?.cssRules ?? []))
      .map((rule) => rule.cssText)
      .filter((text) => Array.from(screen.getAllByTestId('slot-match')[0].classList).some((name) => text.includes(`.${name}`)))
      .join('\n')
    // Each match is its own tight block on a phone (larger gap between matches), and dissolves into the shared grid from sm.
    expect(rowCss).toMatch(/display:\s*grid/)
    expect(rowCss).toMatch(/@media \(min-width:\s*600px\)[^]*display:\s*contents/)
  })
})
