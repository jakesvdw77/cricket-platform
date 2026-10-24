import { Box, BottomNavigation, BottomNavigationAction, Tabs, Tab } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { displayLabelSx } from '../../theme'

export interface NavItem {
  label: string
  to: string
}

export interface NavProps {
  items: NavItem[]
}

// Mobile-first: a thumb-reachable bottom tab bar under md, a conventional top
// tab bar from md up — see docs/standards/frontend.md's mobile-first rule. docs/specs/120: dark platform chrome, gold selected tab.
// Cream labels in the display face, gold when selected (bold as well, so the state is never colour alone).
const tabSx = {
  ...displayLabelSx,
  fontSize: 15,
  color: 'chrome.text',
  '&.Mui-selected': { color: 'chrome.selected', fontWeight: 700 },
  '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'chrome.text', outlineOffset: -2 },
  '& .MuiBottomNavigationAction-label': { fontFamily: 'inherit', fontSize: 13, letterSpacing: '0.04em' },
} as const

export function Nav({ items }: NavProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const currentValue = items.some((item) => item.to === location.pathname) ? location.pathname : false

  return (
    <>
      <Box
        component="nav"
        aria-label="Primary"
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          insetInline: 0,
          bottom: 0,
          zIndex: 10,
          borderTop: 1,
          borderColor: 'chrome.menuLine',
          bgcolor: 'chrome.menu',
        }}
      >
        <BottomNavigation showLabels sx={{ bgcolor: 'transparent' }} value={currentValue} onChange={(_, value: string) => navigate(value)}>
          {items.map((item) => (
            <BottomNavigationAction key={item.to} label={item.label} value={item.to} sx={tabSx} />
          ))}
        </BottomNavigation>
      </Box>

      <Box
        component="nav"
        aria-label="Primary"
        sx={{ display: { xs: 'none', md: 'block' }, borderBottom: 1, borderColor: 'chrome.menuLine', bgcolor: 'chrome.menu' }}
      >
        <Tabs value={currentValue} TabIndicatorProps={{ sx: { bgcolor: 'chrome.selected' } }} onChange={(_, value: string) => navigate(value)}>
          {items.map((item) => (
            <Tab key={item.to} label={item.label} value={item.to} sx={tabSx} />
          ))}
        </Tabs>
      </Box>
    </>
  )
}
