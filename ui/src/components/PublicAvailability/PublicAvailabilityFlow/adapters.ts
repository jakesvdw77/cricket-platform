import * as squadApi from '../../../api/publicPollApi'
import * as groupApi from '../../../api/publicSectionAvailabilityApi'
import type { PublicAnswer, PublicAnswers, VerifyRequest, VerifyResponse } from '../../../api/publicAvailabilityShared'
import { formatBracketLabel } from '../../../utils/dayPart'
import { formatDateTime } from '../../../utils/publicAvailabilityFormat'
import type { AnswerSlot } from '../AnswerForm'

// The one shape the shared flow renders, whichever kind of poll it is (docs/specs/077).
export interface PublicPollContext {
  clubId: string | null
  open: boolean
  // Shown in the brand strip (there is no club name in the header API).
  brandName: string
  title: string
  subtitle: string | null
  details: string[]
  scheduledCloseAt: string | null
  slots: AnswerSlot[]
}

export interface PublicPollAdapter {
  kind: 'squad' | 'group'
  queryKey: (id: string) => unknown[]
  load: (id: string) => Promise<PublicPollContext>
  verify: (id: string, body: VerifyRequest) => Promise<VerifyResponse>
  getAnswers: (id: string, playerId: string, token: string) => Promise<PublicAnswers>
  putAnswers: (id: string, playerId: string, token: string, answers: PublicAnswer[]) => Promise<PublicAnswers>
}

export const SQUAD_SLOT_KEY = 'squad'

export const squadAdapter: PublicPollAdapter = {
  kind: 'squad',
  queryKey: (id) => ['public-poll', id],
  async load(id) {
    const poll = await squadApi.getPoll(id)
    return {
      clubId: poll.clubId,
      open: poll.open,
      brandName: poll.teamName ?? 'Availability',
      title: `${poll.homeTeamName ?? 'Home'} v ${poll.awayTeamName ?? 'TBC'}`,
      subtitle: [poll.matchDate ? formatDateTime(poll.matchDate) : null, poll.venue].filter(Boolean).join(' · ') || null,
      details: [[poll.leagueName, poll.seasonLabel].filter(Boolean).join(' · '), poll.teamName ? `Availability for ${poll.teamName}` : ''].filter(Boolean),
      scheduledCloseAt: poll.scheduledCloseAt,
      slots: [{ key: SQUAD_SLOT_KEY, windowId: null, label: null, matches: [], open: poll.open }],
    }
  },
  verify: squadApi.verify,
  getAnswers: squadApi.getAnswers,
  putAnswers: squadApi.putAnswers,
}

export const groupAdapter: PublicPollAdapter = {
  kind: 'group',
  queryKey: (id) => ['public-section-availability-round', id],
  async load(id) {
    const round = await groupApi.getRound(id)
    const matchCount = round.windows.reduce((total, window) => total + window.matches.length, 0)
    return {
      clubId: round.clubId,
      open: round.open,
      brandName: round.sectionName ?? 'Availability',
      title: round.description ?? round.sectionName ?? 'Availability',
      subtitle:
        [round.description ? round.sectionName : null, matchCount > 0 ? `${matchCount} ${matchCount === 1 ? 'match' : 'matches'}` : null]
          .filter(Boolean)
          .join(' · ') || null,
      details: [],
      scheduledCloseAt: round.scheduledCloseAt,
      slots: round.windows.map((window) => ({
        key: window.windowId,
        windowId: window.windowId,
        label: formatBracketLabel(window.windowDate, window.dayPart, ' · '),
        matches: window.matches.map((match) => `${match.homeTeamName ?? 'TBC'} v ${match.awayTeamName ?? 'TBC'}`),
        open: round.open && window.open,
      })),
    }
  },
  verify: groupApi.verify,
  getAnswers: groupApi.getAnswers,
  putAnswers: groupApi.putAnswers,
}
