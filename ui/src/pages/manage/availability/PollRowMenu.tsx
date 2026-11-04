import { Typography } from '@mui/material'
import { squadPollTitle } from './pollHelpers'
import { PollKebab } from './PollKebab'
import { usePollItemActions } from './usePollItemActions'
import type { PollItemActionsOptions } from './usePollItemActions'

export interface PollRowMenuProps extends PollItemActionsOptions {
  testId?: string
}

// docs/specs/136 and docs/standards/page-anatomy.md section 6: the ONE actions button of a poll table row, a dense kebab menu
// (after LeagueRowMenu): Open Responses, Edit Close Time (Reopen Poll once closed), Edit Description (group), Matches Covered,
// Close Poll, Delete Poll, Share Invite last. It never navigates the row it sits in. A failed close or delete shows under it.
export function PollRowMenu({ testId = 'poll-actions', ...options }: PollRowMenuProps) {
  const actions = usePollItemActions(options)
  const { item, teamsById } = options
  const title = item.kind === 'GROUP' ? item.round.description : squadPollTitle(item.poll, teamsById)
  const key = item.kind === 'GROUP' ? item.round.id : item.poll.pollId
  return (
    <>
      <PollKebab actions={actions} title={title} testId={`${testId}-${key}`} />
      {actions.dialogs}
      {actions.errorMessage && (
        <Typography variant="caption" color="error.main" role="alert" sx={{ position: 'absolute', right: 8, bottom: 2 }}>
          {actions.errorMessage}
        </Typography>
      )}
    </>
  )
}
