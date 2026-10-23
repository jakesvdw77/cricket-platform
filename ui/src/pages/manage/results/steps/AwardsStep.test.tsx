import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { ResultDraft, Scorecard } from '../../../../api/matchResultApi'
import { baseTheme } from '../../../../theme'
import { makeMatch } from '../../../../test/resultFixtures'
import { AwardsStep } from './AwardsStep'

// docs/specs/118: the Awards cards size to their content. InfoCard's root is height: 100%, which inside this stretched column
// squeezed the Standouts card; the column overrides it for its own cards.
describe('AwardsStep layout', () => {
  it('sizes the Standouts card to its content, not to 100% of the column', () => {
    const scorecard = {
      players: [{ clientKey: 'c0', side: 'HOME', playerProfileId: 'p0', displayName: null, plannedBattingOrder: 1, replacedPlayerProfileId: null, substitute: false, firstName: 'Ann', lastName: 'Ash' }],
      batting: [{ battingSide: 'HOME', playerClientKey: 'c0', position: 1, howOut: 'BOWLED', runs: 72, balls: 30, fours: 2, sixes: 1, featuredOverride: null, suggested: true, featured: true }],
      bowling: [],
      fielding: [],
      awards: [],
    } as unknown as Scorecard
    const draft: ResultDraft = { scorecard, innings: [] }
    render(
      <ThemeProvider theme={baseTheme}>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <AwardsStep
              clubId="club-1"
              match={makeMatch()}
              draft={draft}
              onChange={vi.fn()}
              onReplace={vi.fn()}
              sides={[
                { side: 'HOME', name: '1st XI', logo: { kind: 'initials', name: '1st XI' } },
                { side: 'AWAY', name: 'Riverside', logo: { kind: 'initials', name: 'Riverside' } },
              ] as never}
              oursSides={[{ side: 'HOME', teamId: 'team-1', teamName: '1st XI' }]}
              prefill={null}
              prefillState="unavailable"
              scorecardSide="HOME"
              onScorecardSideChange={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>,
    )
    const column = screen.getByTestId('awards-column')
    const card = screen.getByTestId('awards-standouts')
    expect(card.parentElement).toBe(column)
    // (jsdom's computed style ignores selector specificity, so the column's own rule is read from the stylesheet.)
    const rules = Array.from(document.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules).map((rule) => rule.cssText))
    const columnClass = Array.from(column.classList).find((name) => name.startsWith('css-')) as string
    const cardRule = rules.find((text) => text.includes(`.${columnClass}>.MuiCard-root {`))
    expect(cardRule).toMatch(/height:\s*auto/)
    expect(cardRule).toMatch(/flex-shrink:\s*0/)
    expect(rules.find((text) => text.includes(`.${columnClass}>.MuiCard-root>.MuiCardContent-root`))).toMatch(/height:\s*auto/)
    expect(screen.getByText('Ann Ash')).toBeInTheDocument()
  })
})
