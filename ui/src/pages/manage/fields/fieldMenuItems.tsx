import CallMergeIcon from '@mui/icons-material/CallMerge'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import ReplayIcon from '@mui/icons-material/Replay'
import type { ReactNode } from 'react'
import type { ManageMenuItem } from '../../../components/ManageMenu'
import type { PlayingArea } from '../../../api/playingAreaApi'
import { FIELD_STATUS_ACTIONS, FIELD_STATUS_ACTION_LABEL, fieldEditState, fieldStatusOf, VERIFIED_FIELD_NO_ACTIONS } from '../../../utils/fieldStatus'
import type { FieldStatusAction } from '../../../utils/fieldStatus'

export const MANAGER_FIELDS_PATH = '/manage/fixtures/fields'
export const ADMIN_FIELDS_PATH = '/admin/fields'

export interface FieldMenuOptions {
  field: PlayingArea
  // The platform admin's variant: Edit is always allowed, the status actions replace Add To / Remove From Our Fields.
  admin: boolean
  // The calling club (a manager's menu): decides whether Edit is enabled.
  clubId?: string
  // 'row': a list kebab (Open Field first, no Merge). 'page': the Manage Field menu on the field page (no Open Field, Merge for the admin).
  placement: 'row' | 'page'
  // docs/specs/127: wraps an in-app destination with the page the menu is on as its origin.
  leaveTo: (destination: string) => string
  onToggleHome?: (field: PlayingArea) => void
  homePending?: boolean
  onStatusAction?: (field: PlayingArea, action: FieldStatusAction) => void
  onMerge?: () => void
  // docs/specs/133: the Get Directions item (empty or omitted when no point resolves); shown on the page menu only, after Edit Field.
  directions?: ManageMenuItem[]
}

const STATUS_ICON: Record<FieldStatusAction, ReactNode> = {
  verify: <CheckCircleOutlineIcon fontSize="small" />,
  reject: <HighlightOffIcon fontSize="small" />,
  reopen: <ReplayIcon fontSize="small" />,
}

const STATUS_DESCRIPTION: Record<FieldStatusAction, string> = {
  verify: 'Confirm the details are right; the field is then locked for clubs.',
  reject: 'Hide the field from search and ask for a reason first.',
  reopen: 'Put a rejected field back to unverified.',
}

// docs/specs/134 and docs/standards/page-anatomy.md section 6b: the one list of a field's actions, shared by the list kebab
// (`FieldRowMenu`) and the field page's Manage Field menu, so the two can never drift. Nothing is hidden: Edit stays (disabled with
// its reason), a verified field's status item stays (disabled with its reason). There is no Share: a field has nothing to share.
export function fieldMenuItems({ field, admin, clubId, placement, leaveTo, onToggleHome, homePending = false, onStatusAction, onMerge, directions = [] }: FieldMenuOptions): ManageMenuItem[] {
  const base = admin ? ADMIN_FIELDS_PATH : MANAGER_FIELDS_PATH
  const edit = admin ? { editable: true, reason: null } : fieldEditState(field, clubId)
  const status = fieldStatusOf(field)
  const row = placement === 'row'

  const open: ManageMenuItem = { id: 'open', title: 'Open Field', icon: <OpenInNewOutlinedIcon fontSize="small" />, to: leaveTo(`${base}/${field.id}`) }
  const editItem: ManageMenuItem = {
    id: 'edit',
    title: 'Edit Field',
    description: 'Name, type, owner, address and map link.',
    icon: <EditOutlinedIcon fontSize="small" />,
    to: edit.editable ? leaveTo(`${base}/${field.id}/edit`) : undefined,
    disabled: !edit.editable,
    reason: edit.reason ?? undefined,
  }
  const maps: ManageMenuItem[] = field.mapUrl
    ? [
        {
          id: 'maps',
          title: 'Open In Maps',
          description: 'Open the field in your maps app in a new tab.',
          icon: <MapOutlinedIcon fontSize="small" />,
          onClick: () => {
            window.open(field.mapUrl as string, '_blank', 'noopener,noreferrer')
          },
        },
      ]
    : []
  const home: ManageMenuItem[] =
    !admin && onToggleHome
      ? [
          field.linkedHome
            ? {
                id: 'home',
                title: 'Remove From Our Fields',
                description: 'Take this field off your club shortlist; matches keep it.',
                icon: <LinkOffIcon fontSize="small" />,
                onClick: () => onToggleHome(field),
                disabled: homePending,
              }
            : {
                id: 'home',
                title: 'Add To Our Fields',
                description: 'Put this field on your club shortlist.',
                icon: <LinkIcon fontSize="small" />,
                onClick: () => onToggleHome(field),
                disabled: homePending,
              },
        ]
      : []
  const statusActions = FIELD_STATUS_ACTIONS[status]
  const statuses: ManageMenuItem[] =
    admin && onStatusAction
      ? statusActions.length === 0
        ? [
            {
              id: 'status',
              title: 'Change Status',
              icon: <ManageAccountsOutlinedIcon fontSize="small" />,
              disabled: true,
              reason: VERIFIED_FIELD_NO_ACTIONS,
            },
          ]
        : statusActions.map((action) => ({
            id: action,
            title: FIELD_STATUS_ACTION_LABEL[action],
            description: STATUS_DESCRIPTION[action],
            icon: STATUS_ICON[action],
            onClick: () => onStatusAction(field, action),
          }))
      : []
  const merge: ManageMenuItem[] =
    admin && !row && onMerge
      ? [{ id: 'merge', title: 'Merge Into...', description: 'Fold this field into another and move its matches.', icon: <CallMergeIcon fontSize="small" />, onClick: onMerge }]
      : []

  // Row: Open, Edit, the field's own opens (maps), then record actions. Page: Edit, Get Directions, record actions, Merge, links.
  return row ? [open, editItem, ...maps, ...home, ...statuses] : [editItem, ...directions, ...home, ...statuses, ...merge, ...maps]
}
