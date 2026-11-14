import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined'
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined'
import { ManageMenu } from '../../../components/ManageMenu'
import type { ManageMenuItem } from '../../../components/ManageMenu'
import type { AccessGrant } from '../../../api/accessGrantsApi'
import { fullName } from './accessGrantFormat'

export interface AccessGrantRowMenuProps {
  grant: AccessGrant
  // false until a second role may be given (spec 150, Release 2): a one-option dialog is pointless
  showChangeRole: boolean
  onChangeRole: (grant: AccessGrant) => void
  onResend: (grant: AccessGrant) => void
  onRemove: (grant: AccessGrant) => void
  testId?: string
}

// docs/standards/page-anatomy.md section 6: the ONE actions button of a row or card, a dense kebab menu. Only what the server
// would allow this caller; a person with nothing to offer (your own row) gets no kebab at all.
export function AccessGrantRowMenu({ grant, showChangeRole, onChangeRole, onResend, onRemove, testId = 'access-actions' }: AccessGrantRowMenuProps) {
  const items: ManageMenuItem[] = [
    ...(showChangeRole && grant.canChange
      ? [{ id: 'change', title: 'Change Role', icon: <SwapHorizOutlinedIcon fontSize="small" />, onClick: () => onChangeRole(grant) }]
      : []),
    ...(grant.canResend
      ? [{ id: 'resend', title: 'Resend Invitation', icon: <MarkEmailReadOutlinedIcon fontSize="small" />, onClick: () => onResend(grant) }]
      : []),
    ...(grant.canRemove
      ? [{ id: 'remove', title: 'Remove Access', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'error' as const, onClick: () => onRemove(grant) }]
      : []),
  ]
  if (items.length === 0) return null
  return (
    <ManageMenu
      trigger="kebab"
      dense
      label={`Actions for ${fullName(grant)}`}
      testId={`${testId}-${grant.id}`}
      groups={[{ id: 'actions', heading: 'Actions', items }]}
    />
  )
}
