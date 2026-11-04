import { useLocation } from 'react-router-dom'
import type { Team } from '../../../api/teamApi'
import { SectionAvailabilityShareDialog } from '../../../components/SectionAvailabilityShareDialog'
import { PollShareDialog } from '../../../components/PollShareDialog'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { PollMatchesDialog } from './PollMatchesDialog'
import { pollResponsesPath, squadPollTeamName, squadPollTitle } from './pollHelpers'
import type { PollItem } from './pollItem'
import { usePollActions } from './usePollActions'
import type { PollActions } from './usePollActions'

export interface PollItemActionsOptions {
  clubId: string
  item: PollItem
  // Whether a squad poll is open (a group poll carries its own flag, which wins).
  open?: boolean
  teamsById: Map<string, Team>
  // A close, a close time or a description changed, or the poll was deleted: the page refreshes its lists.
  onChanged: () => void
}

// The poll actions of one list item (a table row or a card): the shared usePollActions fed from a PollItem, with every leaving
// link carrying returnTo (docs/specs/127, label "Availability").
export function usePollItemActions({ clubId, item, open = true, teamsById, onChanged }: PollItemActionsOptions): PollActions {
  const location = useLocation()
  const isOpen = item.kind === 'GROUP' ? item.round.open : open
  const target =
    item.kind === 'GROUP'
      ? ({ kind: 'GROUP', roundId: item.round.id } as const)
      : ({ kind: 'SQUAD', matchId: item.poll.matchId, pollId: item.poll.pollId } as const)
  return usePollActions({
    clubId,
    target,
    title: item.kind === 'GROUP' ? item.round.description : squadPollTitle(item.poll, teamsById),
    open: isOpen,
    autoClose: item.kind === 'GROUP' ? item.round.autoClose : item.poll.autoClose,
    scheduledCloseAt: item.kind === 'GROUP' ? item.round.scheduledCloseAt : item.poll.scheduledCloseAt,
    kickoff: item.kind === 'GROUP' ? item.round.firstMatchKickoff : item.poll.matchDate,
    canReopen: item.kind === 'GROUP' ? item.round.canReopen : item.poll.canReopen,
    description: item.kind === 'GROUP' ? { roundId: item.round.id, text: item.round.description } : undefined,
    onChanged,
    onDeleted: onChanged,
    placement: 'row',
    responsesTo: withReturnTo(pollResponsesPath(item), currentOrigin(location), 'Availability'),
    renderMatches: (matchesOpen, onClose) => (
      <PollMatchesDialog open={matchesOpen} onClose={onClose} clubId={clubId} item={item} teamsById={teamsById} />
    ),
    renderShare: (shareOpen, onClose) =>
      item.kind === 'GROUP' ? (
        <SectionAvailabilityShareDialog open={shareOpen} onClose={onClose} round={item.round} />
      ) : (
        <PollShareDialog
          open={shareOpen}
          onClose={onClose}
          match={item.poll}
          teamName={squadPollTeamName(item.poll, teamsById)}
          pollId={item.poll.pollId}
          autoClose={item.poll.autoClose}
          scheduledCloseAt={item.poll.scheduledCloseAt}
        />
      ),
  })
}
