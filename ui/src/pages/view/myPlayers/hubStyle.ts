import { alpha } from '@mui/material/styles'
import { BRAND, FONT_DISPLAY, darkMenuProps } from '../../../brandTokens'

// docs/specs/119 3C: the look of the player hub (a dark, console style screen on the cricket-scene backdrop).
// docs/specs/120: the colours and the (self-hosted) Barlow Condensed stack come from the shared brand tokens.
const { cream, gold, ink, sand } = BRAND
export const HUB = {
  cream,
  gold,
  ink,
  sand,
  line: alpha(cream, 0.28),
  lineSoft: alpha(cream, 0.14),
  muted: alpha(cream, 0.66),
  panelDark: 'rgba(0,0,0,.30)',
  display: FONT_DISPLAY,
}

export const hubHeading = {
  fontFamily: HUB.display,
  fontWeight: 600,
  fontSize: 20,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: HUB.sand,
  m: 0,
} as const

export const hubGoldButton = {
  bgcolor: HUB.gold,
  color: HUB.ink,
  borderRadius: '4px',
  '&:hover': { bgcolor: alpha(HUB.gold, 0.85) },
  '&.Mui-disabled': { bgcolor: alpha(HUB.gold, 0.4), color: alpha(HUB.ink, 0.6) },
  '&.Mui-focusVisible, &:focus-visible': { outline: `2px solid ${HUB.cream}`, outlineOffset: 2 },
} as const

export const hubOutlineButton = {
  color: HUB.gold,
  borderColor: HUB.gold,
  borderRadius: '4px',
  alignSelf: 'flex-start',
  '&:hover': { borderColor: HUB.gold, bgcolor: alpha(HUB.gold, 0.12) },
  '&:focus-visible': { outline: `2px solid ${HUB.cream}`, outlineOffset: 2 },
} as const

export const darkFieldSx = {
  color: HUB.cream,
  '& .MuiTypography-root': { color: 'inherit' },
  '& .MuiInputBase-root': { color: HUB.cream, bgcolor: 'rgba(0,0,0,.28)' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: HUB.line },
  '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: HUB.sand },
  '& .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: HUB.gold, borderWidth: 2 },
  '& .MuiInputLabel-root': { color: HUB.muted },
  '& .MuiInputLabel-root.Mui-focused': { color: HUB.gold },
  '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: alpha(HUB.cream, 0.7) },
  '& .MuiInputLabel-root.Mui-disabled': { color: alpha(HUB.cream, 0.5) },
  '& .Mui-disabled .MuiOutlinedInput-notchedOutline': { borderStyle: 'dashed', borderColor: HUB.lineSoft },
  '& .MuiFormHelperText-root': { color: HUB.muted },
  '& .MuiFormHelperText-root.Mui-error': { color: '#ffb4a9' },
  '& .MuiSelect-icon': { color: HUB.cream },
  '& .MuiCheckbox-root': { color: HUB.muted },
  '& .MuiCheckbox-root.Mui-checked': { color: HUB.gold },
  '& .MuiButton-outlined': { color: HUB.gold, borderColor: HUB.gold },
  '& .MuiInputBase-input:focus-visible, & .MuiCheckbox-root.Mui-focusVisible': { outline: 'none' },
} as const

export { darkMenuProps }
