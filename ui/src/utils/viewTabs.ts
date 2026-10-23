import type { SxProps, Theme } from '@mui/material/styles'
import { displayLabelSx } from '../theme'

// The shared tab strip used by the league view switcher and the league edit page: a 44 px strip with a
// divider underneath that scrolls sideways inside itself on a phone. Spread VIEW_TABS_PROPS onto <Tabs>.
export const VIEW_TABS_PROPS = { variant: 'scrollable', scrollButtons: false } as const

export const viewTabsSx: SxProps<Theme> = { borderBottom: 1, borderColor: 'divider', minHeight: 44 }

// docs/specs/120: tab text in the display face (uppercase); the selected tab keeps the club tint and is bold.
export const viewTabSx: SxProps<Theme> = { ...displayLabelSx, minHeight: 44, fontSize: 16, '&.Mui-selected': { fontWeight: 700 } }
