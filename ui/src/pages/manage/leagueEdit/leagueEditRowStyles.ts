import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { zebraTint } from '../../../utils/zebraTint'

// Shared zebra-row look of the Edit League panels (docs/specs/095-league-edit-gold-standard.md): a 44 px row (56 px on a
// phone), a 40 px uppercase header row, desktop-only cells hidden on a phone.

export const desktopOnly = { display: { xs: 'none', sm: 'block' } } as const
// Marks those cells for assistive tooling and tests (jsdom does not evaluate responsive CSS).
export const DESKTOP_ONLY = { 'data-desktop-only': 'true' } as const

export const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

export function rowGridSx(columns: { xs: string; sm: string }) {
  return {
    display: 'grid',
    gridTemplateColumns: columns,
    alignItems: 'center',
    columnGap: { xs: 0.75, sm: 1.5 },
    pl: 1.5,
    pr: { xs: 0.5, sm: 1.5 },
  } as const
}

export function headerRowSx(columns: { xs: string; sm: string }) {
  return {
    ...rowGridSx(columns),
    height: { xs: 36, sm: 40 },
    bgcolor: 'background.paper',
    borderTop: 1,
    borderBottom: 1,
    borderColor: 'divider',
    fontSize: { xs: '0.6875rem', sm: '0.75rem' },
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'text.secondary',
  } as const
}

export function bodyRowSx(columns: { xs: string; sm: string }) {
  return {
    ...rowGridSx(columns),
    position: 'relative',
    minHeight: { xs: 56, sm: 44 },
    '&:nth-of-type(odd)': { bgcolor: zebraTint },
    '&:hover': { bgcolor: hoverTint },
    '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
  } as const
}
