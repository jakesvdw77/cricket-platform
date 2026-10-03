import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton, Stack, Typography } from '@mui/material'
import { isAxiosError } from 'axios'
import { useMutation } from '@tanstack/react-query'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { RecordCard } from '../../../components/RecordCard'
import { SlotSummary } from '../../../components/SlotSummary'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { PollShareDialog } from '../../../components/PollShareDialog'
import { SectionAvailabilityShareDialog } from '../../../components/SectionAvailabilityShareDialog'
import { closePoll, deletePoll } from '../../../api/matchAvailabilityApi'
import { closeRound, deleteRound, updateRoundDescription } from '../../../api/sectionAvailabilityApi'
import type { Team } from '../../../api/teamApi'
import { dayPartForDate, formatBracketLabel } from '../../../utils/dayPart'
import { errorDetail } from '../../../utils/errorDetail'
import { closePollDescription, closePollTitle } from '../../../utils/pollClose'
import { EditCloseTimeDialog } from './EditCloseTimeDialog'
import { EditDescriptionDialog } from './EditDescriptionDialog'
import { PollMatchesDialog } from './PollMatchesDialog'
import {
  SHARE_CLOSED_REASON,
  closesRowText,
  formatMatchDateTime,
  squadPollSideLabel,
  squadPollTeamName,
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

// docs/specs/066-poll-close-time-and-unified-cards.md: the one card both poll kinds render as, on
// RecordCard: header (avatar, title, badges, delete), a subtitle, one SlotSummary per time slot, a
// Closes row with its pencil, and the same four footer buttons in the same order - Close (Reopen
// once closed), Matches, Responses, Share. It returns the RecordCard itself as the grid item (no
// wrapper) so the dashboard grid can stretch every card in a row to the tallest; every expansion is
// a dialog rendered as a sibling, so a card never changes height on its own. Each card owns its own
// mutations so one card's pending state never leaks onto another's.
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
  const navigate = useNavigate()
  const isOpen = item.kind === 'GROUP' ? item.round.open : open
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeTimeOpen, setCloseTimeOpen] = useState(false)
  const [matchesOpen, setMatchesOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  // The server's own 409 message when picked match squad members block a group delete.
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)

  const autoClose = item.kind === 'GROUP' ? item.round.autoClose : item.poll.autoClose
  const scheduledCloseAt = item.kind === 'GROUP' ? item.round.scheduledCloseAt : item.poll.scheduledCloseAt
  const kickoff = item.kind === 'GROUP' ? item.round.firstMatchKickoff : item.poll.matchDate
  const title = item.kind === 'GROUP' ? item.round.description : squadPollTitle(item.poll, teamsById)

  const deleteMutation = useMutation({
    mutationFn: () =>
      item.kind === 'GROUP' ? deleteRound(clubId, item.round.id) : deletePoll(clubId, item.poll.matchId, item.poll.pollId),
    onSuccess: () => {
      setDeleteOpen(false)
      onChanged()
    },
    onError: (error) => {
      setDeleteOpen(false)
      if (item.kind === 'GROUP' && isAxiosError(error) && error.response?.status === 409) {
        setBlockedMessage(errorDetail(error, "This group poll can't be deleted right now."))
      }
    },
  })

  // Only closing is a plain mutation; reopening goes through EditCloseTimeDialog (a new close time
  // is saved first, since the server refuses a reopen once an automatic close time has passed).
  const closeMutation = useMutation({
    mutationFn: async () => {
      if (item.kind === 'GROUP') {
        await closeRound(clubId, item.round.id)
      } else {
        await closePoll(clubId, item.poll.matchId, item.poll.pollId)
      }
    },
    onSuccess: () => {
      setCloseOpen(false)
      onChanged()
    },
    onError: () => setCloseOpen(false),
  })

  const groupRoundId = item.kind === 'GROUP' ? item.round.id : null
  const descriptionMutation = useMutation({
    mutationFn: async (description: string) => {
      if (!groupRoundId) {
        throw new Error('Only a group poll has an editable description.')
      }
      await updateRoundDescription(clubId, groupRoundId, description)
    },
    onSuccess: () => {
      setDescriptionOpen(false)
      onChanged()
    },
  })

  const subtitle =
    item.kind === 'GROUP'
      ? `${item.round.sectionName} · ${matchCountLabel(item.round.brackets.reduce((sum, bracket) => sum + bracket.coveredMatchCount, 0))}`
      : `${formatMatchDateTime(item.poll.matchDate)} · ${item.poll.venue ?? 'Venue TBC'}`

  const squadTeamName = item.kind === 'SQUAD' ? squadPollTeamName(item.poll, teamsById) : ''

  const badges = [
    { label: isOpen ? 'Open' : 'Closed', tone: isOpen ? ('positive' as const) : ('muted' as const) },
    ...(item.kind === 'SQUAD' ? [{ label: squadPollSideLabel(item.poll), tone: 'muted' as const }] : []),
  ]

  return (
    <>
      <RecordCard
        title={title}
        description={subtitle}
        avatar={{ fallback: <EventAvailableOutlinedIcon fontSize="small" />, shape: 'rounded' }}
        badge={{ label: item.kind === 'GROUP' ? 'Group poll' : 'Squad poll', tone: 'neutral' }}
        badges={badges}
        // Long titles wrap to two lines instead of truncating in the ~320px card.
        titleWrap
        // A pencil after a group poll's title edits its description (matches can't be changed after
        // creation, docs/specs/064 Non-goals); a squad poll's title is derived from its match.
        titleEdit={item.kind === 'GROUP' ? { label: 'Edit description', onClick: () => setDescriptionOpen(true) } : undefined}
        cornerAction={{
          label: 'Delete',
          pendingLabel: 'Deleting…',
          pending: deleteMutation.isPending,
          onClick: () => setDeleteOpen(true),
          icon: <DeleteOutlineIcon fontSize="small" />,
        }}
        footerButtons={[
          isOpen
            ? { label: 'Close', icon: <LockOutlinedIcon fontSize="small" />, onClick: () => setCloseOpen(true), disabled: closeMutation.isPending }
            : { label: 'Reopen', icon: <LockOpenOutlinedIcon fontSize="small" />, onClick: () => setCloseTimeOpen(true) },
          { label: 'Matches', icon: <EventNoteOutlinedIcon fontSize="small" />, onClick: () => setMatchesOpen(true) },
          {
            label: 'Responses',
            icon: <PeopleAltOutlinedIcon fontSize="small" />,
            // docs/specs/065 + 067: each poll kind's responses live on their own page.
            onClick: () =>
              navigate(
                item.kind === 'GROUP'
                  ? `/manage/availability/group/${item.round.id}`
                  : `/manage/availability/squad/${item.poll.matchId}/${item.poll.pollId}`,
              ),
          },
          {
            label: 'Share',
            ariaLabel: isOpen ? 'Share invite' : SHARE_CLOSED_REASON,
            title: isOpen ? undefined : SHARE_CLOSED_REASON,
            icon: <ShareOutlinedIcon fontSize="small" />,
            disabled: !isOpen,
            onClick: () => setShareOpen(true),
          },
        ]}
        feedback={
          closeMutation.isError
            ? { message: errorDetail(closeMutation.error, 'Something went wrong updating this poll. Please try again.'), tone: 'error' }
            : deleteMutation.isError && !blockedMessage
              ? { message: errorDetail(deleteMutation.error, 'Something went wrong deleting this poll. Please try again.'), tone: 'error' }
              : null
        }
      >
        {/* The summary area grows (flex: 1) so the Closes row sits at the bottom of the body and the
            footer below it lines up across the cards of a row. */}
        <Stack spacing={1.5} sx={{ flex: 1 }}>
          {slotsFor(item).map((slot) => (
            <SlotSummary key={slot.key} heading={slot.heading} counts={slot.counts} testIdPrefix={slot.key} compact />
          ))}
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            {closesRowText(isOpen, autoClose, scheduledCloseAt)}
          </Typography>
          <IconButton
            size="small"
            aria-label="Edit close time"
            title="Edit close time"
            onClick={() => setCloseTimeOpen(true)}
            sx={{ position: 'relative' }}
          >
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </RecordCard>

      {item.kind === 'GROUP' && (
        <EditDescriptionDialog
          open={descriptionOpen}
          onClose={() => setDescriptionOpen(false)}
          description={item.round.description}
          pending={descriptionMutation.isPending}
          errorMessage={
            descriptionMutation.isError
              ? errorDetail(descriptionMutation.error, 'Something went wrong saving this description. Please try again.')
              : null
          }
          onSave={(description) => descriptionMutation.mutate(description)}
        />
      )}

      <EditCloseTimeDialog
        open={closeTimeOpen}
        onClose={() => setCloseTimeOpen(false)}
        clubId={clubId}
        target={
          item.kind === 'GROUP'
            ? { kind: 'GROUP', roundId: item.round.id }
            : { kind: 'SQUAD', matchId: item.poll.matchId, pollId: item.poll.pollId }
        }
        autoClose={autoClose}
        scheduledCloseAt={scheduledCloseAt}
        kickoff={kickoff}
        reopen={!isOpen}
        onSaved={onChanged}
      />

      <PollMatchesDialog
        open={matchesOpen}
        onClose={() => setMatchesOpen(false)}
        clubId={clubId}
        item={item}
        teamsById={teamsById}
      />

      {item.kind === 'GROUP' ? (
        <SectionAvailabilityShareDialog open={shareOpen} onClose={() => setShareOpen(false)} round={item.round} />
      ) : (
        <PollShareDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          match={item.poll}
          teamName={squadTeamName}
          pollId={item.poll.pollId}
        />
      )}

      <ConfirmDialog
        open={closeOpen}
        title={closePollTitle()}
        description={closePollDescription(autoClose)}
        confirmLabel="Close poll"
        pendingLabel="Closing…"
        pending={closeMutation.isPending}
        onConfirm={() => closeMutation.mutate()}
        onClose={() => setCloseOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={item.kind === 'GROUP' ? 'Delete this group poll?' : 'Delete this squad poll?'}
        description={
          item.kind === 'GROUP'
            ? `"${title}" and every response to it will be removed. Its fixtures can be polled again afterwards.`
            : `The poll for ${title} and every response to it will be removed. This match can be polled again afterwards.`
        }
        confirmLabel="Delete poll"
        pendingLabel="Deleting…"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => setDeleteOpen(false)}
      />
      <ConfirmDialog
        open={blockedMessage !== null}
        title="Can't delete this poll"
        description={blockedMessage}
        acknowledgeOnly
        onClose={() => setBlockedMessage(null)}
      />
    </>
  )
}
