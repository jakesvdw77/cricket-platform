import type { MyMatchDto, MyMatchListDto, MyMatchSideDto, MyMatchSummaryDto } from '../api/myPlayersApi'

// docs/specs/135: Player Hub match fixtures. Dates are far in the future or past so the tests do not depend on today.
export const summary = (overrides: Partial<MyMatchSummaryDto> = {}): MyMatchSummaryDto => ({
  matchId: 'm1',
  phase: 'UPCOMING',
  date: '2099-11-08',
  time: '09:00',
  home: { name: 'Riverside U15 A', logoUrl: null },
  away: { name: 'Coastal U15', logoUrl: null },
  league: 'TVL Division 1',
  venue: 'Riverside Oval',
  mine: true,
  selection: 'NOT_ANNOUNCED',
  hasLiveScore: false,
  hasStream: false,
  ...overrides,
})

export const matchList = (overrides: Partial<MyMatchListDto> = {}): MyMatchListDto => ({ live: [], upcoming: [], recent: [], ...overrides })

const side = (overrides: Partial<MyMatchSideDto> = {}): MyMatchSideDto => ({ name: 'Riverside U15 A', logoUrl: null, mine: true, announced: false, players: [], ...overrides })

export const matchDto = (overrides: Partial<MyMatchDto> = {}): MyMatchDto => ({
  matchId: 'm1',
  date: '2099-11-08',
  time: '09:00',
  phase: 'UPCOMING',
  status: 'UPCOMING',
  league: { id: 'l1', name: 'TVL Division 1' },
  season: { id: 's1', name: '2099/2100' },
  venue: 'Riverside Oval',
  home: side(),
  away: side({ name: 'Coastal U15', mine: false }),
  selection: 'NOT_ANNOUNCED',
  availability: null,
  liveScore: null,
  stream: null,
  result: null,
  ...overrides,
})

export const LIVE_SCORE = { kind: 'EXTERNAL', url: 'https://scores.example/match/1', host: 'scores.example' } as const
export const STREAM = { url: 'https://www.youtube.com/watch?v=abc123', provider: 'YOUTUBE', embedUrl: 'https://www.youtube-nocookie.com/embed/abc123' } as const
