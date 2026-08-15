import { Box, BottomNavigation, BottomNavigationAction, Tabs, Tab } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

export interface NavItem {
  label: string
  to: string
}

export interface NavProps {
  items: NavItem[]
}

// Mobile-first: a thumb-reachable bottom tab bar under md, a conventional top
// tab bar from md up — see docs/standards/frontend.md's mobile-first rule.
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
          borderColor: 'divider',
        }}
      >
        <BottomNavigation showLabels value={currentValue} onChange={(_, value: string) => navigate(value)}>
          {items.map((item) => (
            <BottomNavigationAction key={item.to} label={item.label} value={item.to} />
          ))}
        </BottomNavigation>
      </Box>

      <Box
        component="nav"
        aria-label="Primary"
        sx={{ display: { xs: 'none', md: 'block' }, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tabs value={currentValue} onChange={(_, value: string) => navigate(value)}>
          {items.map((item) => (
            <Tab key={item.to} label={item.label} value={item.to} />
          ))}
        </Tabs>
      </Box>
    </>
  )
}
