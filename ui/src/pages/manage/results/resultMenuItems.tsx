import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import type { ManageMenuItem } from '../../../components/ManageMenu'
import { UNPUBLISH_TO_EDIT_REASON } from './resultListHelpers'

export interface ResultMenuOptions {
  draft: boolean
  // Where Open Result and Edit Result lead (already carrying returnTo).
  openTo: string
  editTo: string
  onPublish: () => void
  onShare: () => void
}

// docs/specs/138: the ordered actions of one result, built in ONE place for the card and the table row so they cannot drift: Open Result,
// Edit Result (a draft only: disabled with its reason once published), Publish Result (a draft only) and Share Result always last
// (published only: disabled with its reason on a draft).
export function resultMenuItems({ draft, openTo, editTo, onPublish, onShare }: ResultMenuOptions): ManageMenuItem[] {
  return [
    { id: 'open', title: 'Open Result', icon: <OpenInNewOutlinedIcon fontSize="small" />, to: openTo },
    {
      id: 'edit',
      title: 'Edit Result',
      icon: <EditOutlinedIcon fontSize="small" />,
      to: draft ? editTo : undefined,
      disabled: !draft,
      reason: UNPUBLISH_TO_EDIT_REASON,
    },
    ...(draft ? [{ id: 'publish', title: 'Publish Result', icon: <CloudUploadOutlinedIcon fontSize="small" />, onClick: onPublish }] : []),
    {
      id: 'share',
      title: 'Share Result',
      icon: <ShareOutlinedIcon fontSize="small" />,
      onClick: onShare,
      disabled: draft,
      reason: 'Publish the result to share it',
    },
  ]
}
