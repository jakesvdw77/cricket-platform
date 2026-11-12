import { ToggleButtonGroup } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import type { ReactNode } from 'react'
import { alpha } from '@mui/material/styles'
import { BRAND, FONT_DISPLAY } from '../../brandTokens'
import { toolbarSegmentedSx } from '../ToolbarCard/toolbarControlSx'

export interface CompactToggleGroupProps<T extends string> {
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  // ToggleButton children (each with its own value and aria-label).
  children: ReactNode
  // Two or more equal parts across the full width with 44 px tap targets: the phone Filters sheet.
  fullWidth?: boolean
  // Compact on a desktop, full width with 40 px buttons on a phone (a form's side selector).
  fullWidthOnPhone?: boolean
  // The toolbar look (a sibling of the toolbar's select and search: 36 px, 13 px weight 600 ink text, white, hairline edge, 6 px radius).
  toolbar?: boolean
  // 'dark': the Player Hub console look (transparent ground, muted cream edge, 12 px uppercase condensed labels, cream-tinted selected pill with gold text, gold focus ring).
  tone?: 'light' | 'dark'
}

const buttonSx = {
  height: 28,
  px: 1.25,
  gap: 0.75,
  fontSize: '0.8rem',
  fontWeight: 600,
  textTransform: 'none',
  color: 'text.secondary',
  borderColor: 'divider',
} as const

// The selected option is a light primary tint (the content line is quiet; the Availability switch keeps its solid fill).
const selectedSx = {
  bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.12),
  color: 'primary.dark',
  fontWeight: 700,
} as const

const darkGroupSx = {
  flex: 'none',
  bgcolor: 'transparent',
  '& .MuiToggleButton-root': {
    height: 28,
    px: 1.25,
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.08em',
    lineHeight: 1,
    textTransform: 'uppercase',
    color: alpha(BRAND.cream, 0.66),
    borderColor: alpha(BRAND.cream, 0.28),
    bgcolor: 'transparent',
    '&:hover': { bgcolor: alpha(BRAND.cream, 0.1), color: BRAND.cream },
    '&.Mui-focusVisible': { outline: `2px solid ${BRAND.gold}`, outlineOffset: -2 },
    '&.Mui-disabled': { color: alpha(BRAND.cream, 0.32), borderColor: alpha(BRAND.cream, 0.14) },
  },
  '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': {
    bgcolor: alpha(BRAND.cream, 0.16),
    color: BRAND.gold,
    fontWeight: 700,
  },
} as const

function groupSx(fullWidth: boolean, fullWidthOnPhone: boolean, toolbar: boolean, dark: boolean): SxProps<Theme> {
  if (dark) return darkGroupSx
  if (toolbar) {
    return toolbarSegmentedSx
  }
  return (theme: Theme) => ({
    flex: 'none',
    bgcolor: 'background.paper',
    '& .MuiToggleButton-root': {
      ...buttonSx,
      ...(fullWidth ? { flex: 1, height: 44, fontSize: '0.875rem' } : {}),
      ...(fullWidthOnPhone
        ? { [theme.breakpoints.down('sm')]: { flex: 1, height: 40, fontSize: '0.875rem' } }
        : {}),
    },
    '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': selectedSx,
    ...(fullWidth ? { width: '100%' } : {}),
    ...(fullWidthOnPhone ? { [theme.breakpoints.down('sm')]: { width: '100%' } } : {}),
  })
}

// docs/specs/088 (the Cards | List switch) and docs/specs/089 (a match's side selector): the app's one compact segmented
// switch - a small exclusive ToggleButtonGroup with a light primary tint on the selected option. Clicking the selected
// option again keeps it selected.
export function CompactToggleGroup<T extends string>({
  value,
  onChange,
  ariaLabel,
  children,
  fullWidth = false,
  fullWidthOnPhone = false,
  toolbar = false,
  tone = 'light',
}: CompactToggleGroupProps<T>) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      size="small"
      aria-label={ariaLabel}
      onChange={(_event, next: T | null) => {
        if (next) onChange(next)
      }}
      sx={groupSx(fullWidth, fullWidthOnPhone, toolbar, tone === 'dark')}
    >
      {children}
    </ToggleButtonGroup>
  )
}
