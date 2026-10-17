import { render } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { vi } from 'vitest'
import type { ReactElement } from 'react'
import type { Match } from '../../api/matchApi'
import type { MatchResult } from '../../api/matchResultApi'
import { baseTheme } from '../../theme'
import { DEFAULT_SHARE_CHOICES } from '../../utils/share/shareChoices'
import type { ShareChoices } from '../../utils/share/shareChoices'
import { buildShareResultModel } from '../../utils/share/shareResultData'
import type { ShareScreenProps } from './shareScreenTypes'

const match = {
  id: 'm1',
  homeTeamId: 't1',
  homeTeamName: 'Riverside 1',
  awayTeamId: null,
  awayTeamName: 'Pretoria CC',
  homeTeamLogoUrl: null,
  awayTeamLogoUrl: null,
  matchDate: '2026-10-17T10:00:00',
  venue: 'Main Oval',
} as unknown as Match

const result = {
  outcomeType: 'WON',
  decidedBy: 'REGULAR',
  winningSide: 'HOME',
  marginType: 'RUNS',
  marginValue: 24,
  ballsPerOver: 6,
  innings: [
    { sequence: 1, kind: 'REGULAR', battingSide: 'HOME', runs: 150, wickets: 6, balls: 240 },
    { sequence: 2, kind: 'REGULAR', battingSide: 'AWAY', runs: 126, wickets: 10, balls: 230 },
  ],
} as unknown as MatchResult

export const updateChoices = vi.fn()
export const setInitials = vi.fn()

export function makeScreenProps(overrides: Partial<ShareScreenProps> = {}, choices: Partial<ShareChoices> = {}): ShareScreenProps {
  const model = buildShareResultModel({ match, result, teamsChoice: 'both', initialsOnly: false })
  return {
    model,
    cardModel: model,
    choices: { ...DEFAULT_SHARE_CHOICES, ...choices },
    updateChoices,
    initials: {
      value: false,
      locked: false,
      lockReason: null,
      setValue: setInitials,
      followsClubDefault: true,
      clubDefault: false,
      setClubDefault: vi.fn(),
      clubDefaultSaving: false,
      clubDefaultFailed: false,
    },
    sponsors: [],
    selectedSponsorIds: [],
    clubLogoUrl: null,
    leagueLogoUrl: null,
    clubWebsite: null,
    shareTitle: 'Riverside 1 v Pretoria CC',
    ...overrides,
  }
}

export function renderScreen(element: ReactElement) {
  return render(<ThemeProvider theme={baseTheme}>{element}</ThemeProvider>)
}

// A Canvas2D that does nothing, and a toBlob that yields a PNG, so the screens' preview effect can complete under jsdom.
export function mockCanvas(blob: Blob | null = new Blob(['png'], { type: 'image/png' })) {
  const context = {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    measureText: (text: string) => ({ width: text.length * 10 }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(blob))
  return context
}
