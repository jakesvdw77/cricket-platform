import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EqualizerOutlinedIcon from '@mui/icons-material/EqualizerOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import type { ManageMenuItem } from '../components/ManageMenu'

export interface TeamMenuOptions {
  // Where Open Team and View Squad lead (the team page, already carrying returnTo). Omit both on the Team page itself.
  openTo?: string
  editTo: string
  statsTo: string
  // docs/specs/153: the Team page only; opens the Print Team Sheet dialog.
  onPrintSheet?: () => void
}

// docs/specs/142: the ordered actions of one team, built in ONE place for the card, the table row and the Team page so they cannot drift:
// Open Team and View Squad (the squad is on the team page; not on the Team page itself), Edit Team, View Stats.
export function teamMenuItems({ openTo, editTo, statsTo, onPrintSheet }: TeamMenuOptions): ManageMenuItem[] {
  return [
    ...(openTo ? [{ id: 'open', title: 'Open Team', icon: <OpenInNewOutlinedIcon fontSize="small" />, to: openTo }] : []),
    { id: 'edit', requires: 'TEAMS_EDIT', title: 'Edit Team', icon: <EditOutlinedIcon fontSize="small" />, to: editTo },
    { id: 'stats', title: 'View Stats', icon: <EqualizerOutlinedIcon fontSize="small" />, to: statsTo },
    ...(openTo ? [{ id: 'squad', title: 'View Squad', icon: <GroupsOutlinedIcon fontSize="small" />, to: `${openTo}#squad` }] : []),
    ...(onPrintSheet
      ? [
          {
            id: 'print-sheet',
            requires: 'TEAMS_VIEW' as const,
            title: 'Print Team Sheet',
            description: 'A blank sheet, or one with the match filled in, listing the whole squad.',
            icon: <PrintOutlinedIcon fontSize="small" />,
            onClick: onPrintSheet,
          },
        ]
      : []),
  ]
}
