import { useLocation } from 'react-router-dom'
import { ManageMenu } from '../../../components/ManageMenu'
import type { PlayingArea } from '../../../api/playingAreaApi'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import type { FieldStatusAction } from '../../../utils/fieldStatus'
import { fieldMenuItems } from './fieldMenuItems'

export interface FieldRowMenuProps {
  field: PlayingArea
  // The platform admin's list (`/admin/fields`): status actions instead of Add To / Remove From Our Fields.
  admin?: boolean
  clubId?: string
  onToggleHome?: (field: PlayingArea) => void
  homePending?: boolean
  onStatusAction?: (field: PlayingArea, action: FieldStatusAction) => void
  testId?: string
}

// docs/specs/134 and docs/standards/page-anatomy.md section 6: the ONE actions button of a field row or card, a dense kebab menu
// (manager: Open Field, Edit Field, Open In Maps, Add To / Remove From Our Fields; admin: Open Field, Edit Field, Open In Maps,
// Verify / Reject / Reopen). Merge is on the field page only (destructive, page-anatomy 6b). The button never navigates its row.
export function FieldRowMenu({ field, admin = false, clubId, onToggleHome, homePending, onStatusAction, testId = 'field-actions' }: FieldRowMenuProps) {
  const location = useLocation()
  // docs/specs/127: every destination returns to the list the menu is on.
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), 'Fields')
  const items = fieldMenuItems({ field, admin, clubId, placement: 'row', leaveTo, onToggleHome, homePending, onStatusAction })
  return (
    <ManageMenu
      trigger="kebab"
      dense
      label={`Actions for ${field.name}`}
      testId={`${testId}-${field.id}`}
      groups={[{ id: 'actions', heading: 'Actions', items }]}
    />
  )
}
