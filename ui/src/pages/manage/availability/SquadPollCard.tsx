import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import { RecordCard } from '../../../components/RecordCard'
import type { RecordCardField } from '../../../components/RecordCard'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { AvailabilityRespondentAvatars } from '../../../components/AvailabilityRespondentAvatars'
import { closePoll, deletePoll, openPoll } from '../../../api/matchAvailabilityApi'
import type { OpenAvailabilityPoll } from '../../../api/matchAvailabilityApi'
import type { Team } from '../../../api/teamApi'
import { errorDetail } from '../../../utils/errorDetail'
import { CANNOT_REOPEN_MESSAGE, closePollDescription, closePollTitle } from '../../../utils/pollClose'
import { canReopen, closesValue, squadPollTitle } from './pollHelpers'

function editToFor(poll: OpenAvailabilityPoll): string {
  const side = poll.teamId === poll.homeTeamId ? 'home' : 'away'
  return `/manage/fixtures/matches/${poll.matchId}/edit?tab=availability&side=${side}`
}

function pollFields(poll: OpenAvailabilityPoll): RecordCardField[] {
  const fields: RecordCardField[] = [{ label: 'Date & time', value: new Date(poll.matchDate).toLocaleString() }]

  if (poll.venue) {
    fields.push({ label: 'Venue', value: poll.venue })
  }

  // docs/specs/064-unified-availability-polls.md: 'Closes <date time>' or 'Closes manually'.
  fields.push(
    { label: 'Closes', value: closesValue(poll.autoClose, poll.scheduledCloseAt) },
    {
      label: 'Available',
      value: <AvailabilityRespondentAvatars status="AVAILABLE" respondents={poll.availableRespondents} count={poll.availableCount} />,
    },
    {
      label: 'Unavailable',
      value: (
        <AvailabilityRespondentAvatars status="UNAVAILABLE" respondents={poll.unavailableRespondents} count={poll.unavailableCount} />
      ),
    },
    {
      label: 'Unsure',
      value: <AvailabilityRespondentAvatars status="UNSURE" respondents={poll.unsureRespondents} count={poll.unsureCount} />,
    },
    { label: 'No response', value: poll.noResponseCount },
  )

  return fields
}

// One RecordCard per open squad poll — 034's PollCard (unchanged Edit deep-link and respondent
// avatars), extracted out of AvailabilityPollsDashboard.tsx by docs/specs/064-unified-
// availability-polls.md, now with a 'Squad poll' type badge, a Closes row and a Delete action.
export function SquadPollCard({
  clubId,
  poll,
  open = true,
  teamsById,
  onChanged,
}: {
  clubId: string
  poll: OpenAvailabilityPoll
  // Whether this poll is open - the dashboard knows from which list (open/closed) it came.
  open?: boolean
  teamsById: Map<string, Team>
  onChanged: () => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const title = squadPollTitle(poll, teamsById)
  const sideLabel = poll.teamId === poll.homeTeamId ? 'Home' : 'Away'

  const deleteMutation = useMutation({
    mutationFn: () => deletePoll(clubId, poll.matchId, poll.pollId),
    onSuccess: () => {
      setDeleteOpen(false)
      onChanged()
    },
    onError: () => setDeleteOpen(false),
  })

  const toggleMutation = useMutation({
    mutationFn: () => (open ? closePoll(clubId, poll.matchId, poll.pollId) : openPoll(clubId, poll.matchId, poll.pollId)),
    onSuccess: () => {
      setCloseOpen(false)
      onChanged()
    },
    onError: () => setCloseOpen(false),
  })

  // Reopen is only offered until the poll's automatic close time (docs/specs/064).
  const reopenBlocked = !open && !canReopen(poll)

  return (
    <>
      <RecordCard
        title={title}
        avatar={{ fallback: <EventAvailableOutlinedIcon fontSize="small" />, shape: 'rounded' }}
        badge={{ label: 'Squad poll', tone: 'neutral' }}
        badges={[
          { label: open ? 'Open' : 'Closed', tone: open ? 'positive' : 'muted' },
          { label: sideLabel, tone: 'muted' },
        ]}
        fields={pollFields(poll)}
        editLabel="Manage responses"
        editTo={editToFor(poll)}
        secondaryAction={
          reopenBlocked
            ? undefined
            : {
                label: open ? 'Close' : 'Reopen',
                pendingLabel: open ? 'Closing…' : 'Reopening…',
                pending: toggleMutation.isPending,
                onClick: () => (open ? setCloseOpen(true) : toggleMutation.mutate()),
                icon: open ? <LockOutlinedIcon fontSize="small" /> : <LockOpenOutlinedIcon fontSize="small" />,
              }
        }
        cornerAction={{
          label: 'Delete',
          pendingLabel: 'Deleting…',
          pending: deleteMutation.isPending,
          onClick: () => setDeleteOpen(true),
          icon: <DeleteOutlineIcon fontSize="small" />,
        }}
        secondaryActions={[
        ]}
        feedback={
          toggleMutation.isError
            ? { message: errorDetail(toggleMutation.error, 'Something went wrong updating this poll. Please try again.'), tone: 'error' }
            : reopenBlocked
            ? { message: CANNOT_REOPEN_MESSAGE, tone: 'muted' }
            : deleteMutation.isError
            ? { message: errorDetail(deleteMutation.error, 'Something went wrong deleting this poll. Please try again.'), tone: 'error' }
            : null
        }
      />

      <ConfirmDialog
        open={closeOpen}
        title={closePollTitle()}
        description={closePollDescription(poll.autoClose)}
        confirmLabel="Close poll"
        pendingLabel="Closing…"
        pending={toggleMutation.isPending}
        onConfirm={() => toggleMutation.mutate()}
        onClose={() => setCloseOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this squad poll?"
        description={`The poll for ${title} and every response to it will be removed. This match can be polled again afterwards.`}
        confirmLabel="Delete poll"
        pendingLabel="Deleting…"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  )
}
