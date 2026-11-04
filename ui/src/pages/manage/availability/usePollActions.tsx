import { useState } from 'react'
import type { ReactNode } from 'react'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import type { ManageMenuItem } from '../../../components/ManageMenu'
import { usePollClose } from '../../../hooks/usePollClose'
import type { PollCloseTarget } from '../../../hooks/usePollClose'
import { usePollDelete } from '../../../hooks/usePollDelete'
import { errorDetail } from '../../../utils/errorDetail'
import { EditCloseTimeDialog } from './EditCloseTimeDialog'
import { REOPEN_PAST_REASON, SHARE_CLOSED_REASON } from './pollHelpers'
import { usePollDescription } from './usePollDescription'

export interface PollActionsOptions {
  clubId: string
  target: PollCloseTarget
  // The poll's name (the delete confirmation).
  title: string
  open: boolean
  autoClose: boolean
  scheduledCloseAt: string | null
  // The earliest covered match's kickoff (the close time dialog's base).
  kickoff: string
  canReopen: boolean
  // A group poll only: its round and saved description (Edit Description).
  description?: { roundId: string; text: string }
  // Called after a close, a close time or a description change (the caller refreshes its data).
  onChanged: () => void
  // Called after the poll has been deleted (a list refreshes, a poll page leaves).
  onDeleted: () => void
  // The share dialog and the Matches Covered dialog differ per poll kind and page; each caller renders its own.
  renderShare: (open: boolean, onClose: () => void) => ReactNode
  renderMatches?: (open: boolean, onClose: () => void) => ReactNode
  // 'row' (kebab on a row or card) or 'page' (the Manage Poll menu on a Responses page): the item order differs
  // (docs/specs/136), the items do not.
  placement: 'row' | 'page'
  // Open Responses (row) and Open Match (a squad poll's page) destinations, already carrying returnTo.
  responsesTo?: string
  openMatchTo?: string
}

export interface PollActions {
  items: ManageMenuItem[]
  // Opens the share dialog while the poll is open, else null: the page header's Share button (docs/standards/page-anatomy.md).
  share: (() => void) | null
  // Render once next to the caller's own UI.
  dialogs: ReactNode
  // The close or delete failure as text, or null.
  errorMessage: string | null
}

// docs/specs/136: every action of one poll (squad or group) in one place: the dialogs, the shared close, delete and description
// hooks, and the ordered menu items for the row and card kebab (PollRowMenu) and the Responses page's Manage Poll menu, so the
// two menus cannot drift. Share Invite is always last (page-anatomy section 8).
export function usePollActions({
  clubId,
  target,
  title,
  open,
  autoClose,
  scheduledCloseAt,
  kickoff,
  canReopen,
  description,
  onChanged,
  onDeleted,
  renderShare,
  renderMatches,
  placement,
  responsesTo,
  openMatchTo,
}: PollActionsOptions): PollActions {
  const [closeTimeOpen, setCloseTimeOpen] = useState(false)
  const [matchesOpen, setMatchesOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const pollClose = usePollClose({ clubId, target, autoClose, onClosed: onChanged })
  const pollDelete = usePollDelete({ clubId, target, title, onDeleted })
  const pollDescription = usePollDescription({
    clubId,
    roundId: description?.roundId ?? '',
    description: description?.text ?? '',
    onSaved: onChanged,
  })

  const responsesItem: ManageMenuItem[] = responsesTo
    ? [{ id: 'open-responses', title: 'Open Responses', icon: <PeopleAltOutlinedIcon fontSize="small" />, to: responsesTo }]
    : []
  const openMatchItem: ManageMenuItem[] = openMatchTo
    ? [{ id: 'open-match', title: 'Open Match', icon: <OpenInNewOutlinedIcon fontSize="small" />, to: openMatchTo }]
    : []
  const descriptionItem: ManageMenuItem[] = description
    ? [{ id: 'edit-description', title: 'Edit Description', icon: <EditOutlinedIcon fontSize="small" />, onClick: pollDescription.openEditor }]
    : []
  // An open poll edits its close time; a closed one reopens (disabled with its reason when every match is in the past).
  const closeTimeItem: ManageMenuItem = open
    ? { id: 'edit-close-time', title: 'Edit Close Time', icon: <EditCalendarOutlinedIcon fontSize="small" />, onClick: () => setCloseTimeOpen(true) }
    : {
        id: 'reopen',
        title: 'Reopen Poll',
        icon: <LockOpenOutlinedIcon fontSize="small" />,
        onClick: () => setCloseTimeOpen(true),
        disabled: !canReopen,
        reason: REOPEN_PAST_REASON,
      }
  const matchesItem: ManageMenuItem[] = renderMatches
    ? [{ id: 'matches', title: 'Matches Covered', icon: <EventNoteOutlinedIcon fontSize="small" />, onClick: () => setMatchesOpen(true) }]
    : []
  const closeItem: ManageMenuItem[] = open
    ? [{ id: 'close', title: 'Close Poll', icon: <LockOutlinedIcon fontSize="small" />, onClick: pollClose.requestClose, disabled: pollClose.closing }]
    : []
  const deleteItem: ManageMenuItem = {
    id: 'delete',
    title: 'Delete Poll',
    icon: <DeleteOutlineIcon fontSize="small" />,
    onClick: pollDelete.requestDelete,
    disabled: pollDelete.deleting,
    tone: 'error',
  }
  const shareItem: ManageMenuItem = {
    id: 'share',
    title: 'Share Invite',
    icon: <ShareOutlinedIcon fontSize="small" />,
    onClick: () => setShareOpen(true),
    disabled: !open,
    reason: SHARE_CLOSED_REASON,
  }

  const items: ManageMenuItem[] =
    placement === 'row'
      ? [...responsesItem, closeTimeItem, ...descriptionItem, ...matchesItem, ...closeItem, deleteItem, shareItem]
      : [...descriptionItem, closeTimeItem, ...closeItem, ...openMatchItem, ...matchesItem, deleteItem, shareItem]

  const failure = pollClose.closeError
    ? errorDetail(pollClose.closeError, 'Something went wrong updating this poll. Please try again.')
    : pollDelete.deleteError
      ? errorDetail(pollDelete.deleteError, 'Something went wrong deleting this poll. Please try again.')
      : null

  return {
    items,
    // docs/standards/page-anatomy.md (owner, 2026-11-05): the page header shows Share beside the menu while the poll is open.
    share: open ? () => setShareOpen(true) : null,
    errorMessage: failure,
    dialogs: (
      <>
        {description && pollDescription.dialog}
        <EditCloseTimeDialog
          open={closeTimeOpen}
          onClose={() => setCloseTimeOpen(false)}
          clubId={clubId}
          target={target}
          autoClose={autoClose}
          scheduledCloseAt={scheduledCloseAt}
          kickoff={kickoff}
          reopen={!open}
          onSaved={onChanged}
        />
        {renderMatches?.(matchesOpen, () => setMatchesOpen(false))}
        {renderShare(shareOpen, () => setShareOpen(false))}
        {pollClose.confirmDialog}
        {pollDelete.dialogs}
      </>
    ),
  }
}
