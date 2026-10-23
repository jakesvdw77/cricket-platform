import { Box, Menu, MenuItem, Typography, useMediaQuery, useTheme } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import { alpha } from '@mui/material/styles'
import { BRAND, DARK_MENU_BG } from '../../brandTokens'
import { BottomSheet } from '../BottomSheet'

export interface ProfileSwitchItem {
  key: string
  title: string
  subtitle?: string | null
  active: boolean
  onChoose: () => void
}

export interface ProfileSwitcherProps {
  items: ProfileSwitchItem[]
  // Where the desktop menu opens from; null means closed.
  anchorEl: HTMLElement | null
  onClose: () => void
  // The dark console look (account area) rather than the light manager look.
  dark?: boolean
}

// docs/specs/119 slice 4: "Switch profile". The same cards as the chooser, the loaded one marked. A menu on desktop, a bottom
// sheet on a phone. The caller only renders it for a person with more than one profile.
export function ProfileSwitcher({ items, anchorEl, onClose, dark = false }: ProfileSwitcherProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true })
  const open = Boolean(anchorEl)
  const choose = (item: ProfileSwitchItem) => {
    onClose()
    if (!item.active) item.onChoose()
  }

  const rows = items.map((item) => (
    <MenuItem key={item.key} selected={item.active} onClick={() => choose(item)} sx={{ minHeight: 56, gap: 1.5, whiteSpace: 'normal' }} aria-current={item.active ? 'true' : undefined}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700}>
          {item.title}
        </Typography>
        {item.subtitle && (
          <Typography variant="caption" color={dark ? undefined : 'text.secondary'} sx={dark ? { opacity: 0.7 } : undefined}>
            {item.subtitle}
          </Typography>
        )}
      </Box>
      {item.active && <CheckIcon fontSize="small" aria-label="Loaded" />}
    </MenuItem>
  ))

  if (phone) {
    return (
      <BottomSheet open={open} onOpen={() => undefined} onClose={onClose} ariaLabel="Switch profile" title="Switch profile" closeLabel="Close">
        <Box role="menu">{rows}</Box>
      </BottomSheet>
    )
  }
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      PaperProps={{ sx: dark ? { bgcolor: DARK_MENU_BG, color: BRAND.cream, border: `1px solid ${alpha(BRAND.cream, 0.28)}`, minWidth: 240 } : { minWidth: 240 } }}
    >
      {rows}
    </Menu>
  )
}
