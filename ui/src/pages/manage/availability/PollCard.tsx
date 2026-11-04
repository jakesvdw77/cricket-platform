import { useLocation } from 'react-router-dom'
import { Stack } from '@mui/material'
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined'
import { RecordCard } from '../../../components/RecordCard'
import { BrandIcon } from '../../../components/BrandIcon'
import { CardTimeStrip } from '../../../components/CardTimeStrip'
import { Countdown, useCountdown } from '../../../components/Countdown'
import { SlotSummary } from '../../../components/SlotSummary'
import type { Team } from '../../../api/teamApi'
import { dayPartForDate, formatBracketLabel } from '../../../utils/dayPart'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { PollKebab } from './PollKebab'
import { usePollItemActions } from './usePollItemActions'
import {
  closesRow,
  formatMatchDateTime,
  pollResponsesPath,
  squadPollSideLabel,
  squadPollTitle,
} from './pollHelpers'
import type { PollItem } from './pollItem'

// One slot of the card's body: heading, the four counts, and the id its bar test ids hang off.
interface CardSlot {
  key: string
  heading: string
  counts: { available: number; unsure: number; unavailable: number; noResponse: number }
}

function slotsFor(item: PollItem): CardSlot[] {
  if (item.kind === 'GROUP') {
    return item.round.brackets.map((bracket) => ({
      key: bracket.windowId,
      heading: formatBracketLabel(bracket.windowDate, bracket.dayPart, ' · '),
      counts: {
        available: bracket.availableCount,
        unsure: bracket.unsureCount,
        unavailable: bracket.unavailableCount,
        noResponse: bracket.noResponseCount,
      },
    }))
  }
  const { poll } = item
  return [
    {
      key: poll.pollId,
      heading: formatBracketLabel(poll.matchDate, dayPartForDate(new Date(poll.matchDate)), ' · '),
      counts: {
        available: poll.availableCount,
        unsure: poll.unsureCount,
        unavailable: poll.unavailableCount,
        noResponse: poll.noResponseCount,
      },
    },
  ]
}

function matchCountLabel(count: number): string {
  return `${count} match${count === 1 ? '' : 'es'}`
}

// docs/specs/066-poll-close-time-and-unified-cards.md, revamped by docs/specs/136: the one card both poll kinds render as, on a flat
// RecordCard: header (avatar, title, badges, ONE actions kebab in the corner), a subtitle, a highlighted "Poll closes" strip with a
// live countdown (073, 082) and one SlotSummary per time slot. No footer bar and no pencils: every action (Open Responses, Edit
// Close Time or Reopen Poll, Edit Description, Matches Covered, Close Poll, Delete Poll, Share Invite) is in the kebab. It returns
// the RecordCard itself as the grid item (no wrapper) so the grid can stretch every card in a row to the tallest; every expansion is
// a dialog rendered as a sibling, so a card never changes height on its own. Each card owns its own mutations so one card's pending
// state never leaks onto another's.
export function PollCard({
  clubId,
  item,
  open = true,
  teamsById,
  onChanged,
}: {
  clubId: string
  item: PollItem
  // Whether a squad poll is open - the dashboard knows from which list (open/closed) it came. A
  // group poll carries its own flag, which wins.
  open?: boolean
  teamsById: Map<string, Team>
  onChanged: () => void
}) {
  const location = useLocation()
  const isOpen = item.kind === 'GROUP' ? item.round.open : open

  const autoClose = item.kind === 'GROUP' ? item.round.autoClose : item.poll.autoClose
  const scheduledCloseAt = item.kind === 'GROUP' ? item.round.scheduledCloseAt : item.poll.scheduledCloseAt
  const title = item.kind === 'GROUP' ? item.round.description : squadPollTitle(item.poll, teamsById)

  const actions = usePollItemActions({ clubId, item, open, teamsById, onChanged })

  const subtitle =
    item.kind === 'GROUP'
      ? `${item.round.sectionName} · ${matchCountLabel(item.round.brackets.reduce((sum, bracket) => sum + bracket.coveredMatchCount, 0))}`
      : `${formatMatchDateTime(item.poll.matchDate)} · ${item.poll.venue ?? 'Venue TBC'}`

  const closes = closesRow(isOpen, autoClose, scheduledCloseAt)
  // docs/specs/082: the countdown (and the amber tone) exist only for an open poll with a close time.
  const countdownTarget = isOpen && autoClose && scheduledCloseAt ? scheduledCloseAt : null
  const closingSoon = useCountdown(countdownTarget).warn

  const badges = [
    { label: item.kind === 'GROUP' ? 'Group Poll' : 'Squad Poll', tone: item.kind === 'GROUP' ? ('groupPoll' as const) : ('squadPoll' as const) },
    { label: isOpen ? 'Open' : 'Closed', tone: isOpen ? ('open' as const) : ('closed' as const) },
    ...(item.kind === 'SQUAD' ? [{ label: squadPollSideLabel(item.poll), tone: 'side' as const }] : []),
  ]
  const kebabKey = item.kind === 'GROUP' ? item.round.id : item.poll.pollId

  return (
    <>
      <RecordCard
        flat
        title={title}
        // docs/specs/073: the whole card opens the Responses page, like the Match card (docs/specs/127: and returns here).
        viewTo={withReturnTo(pollResponsesPath(item), currentOrigin(location), 'Availability')}
        description={subtitle}
        // docs/specs/082: the brand availability icon on its standard tile; 48px icon + 4px padding on
        // each side is the 56px avatar box.
        avatar={{ element: <BrandIcon name="nav/availability-polls" size={48} padding={4} /> }}
        // The badges sit under the title row, the kebab stays top right.
        badgesBelow
        badges={badges}
        // Long titles wrap (up to three lines).
        titleWrap
        titleLines={3}
        headerActions={<PollKebab actions={actions} title={title} testId={`poll-card-actions-${kebabKey}`} />}
        // No footer action bar (page-anatomy section 6): the kebab in the corner holds every action.
        footerActions={null}
        feedback={actions.errorMessage ? { message: actions.errorMessage, tone: 'error' } : null}
      >
        {/* docs/specs/082: the close time is read first - a tinted strip above the response indicator,
            amber within 24 hours of closing, neutral otherwise (and once closed). docs/specs/087: the strip
            is the shared CardTimeStrip, which the match card uses too. */}
        <CardTimeStrip
          testId="poll-closes-row"
          tone={closingSoon ? 'warning' : 'neutral'}
          icon={<EventBusyOutlinedIcon fontSize="small" />}
          label={closes.label}
          value={closes.value}
          trailing={countdownTarget ? <Countdown target={countdownTarget} phrase="left" ariaPrefix="Closes in" /> : undefined}
        />
        {/* The summary area grows (flex: 1) so the cards of a row line up. */}
        <Stack spacing={1.5} sx={{ flex: 1 }}>
          {slotsFor(item).map((slot) => (
            <SlotSummary key={slot.key} heading={slot.heading} counts={slot.counts} testIdPrefix={slot.key} compact />
          ))}
        </Stack>
      </RecordCard>

      {actions.dialogs}
    </>
  )
}
