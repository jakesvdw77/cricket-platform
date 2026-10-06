import { Box, Paper } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { NavItemIcon } from '../NavItemIcon'
import { activeTabId } from '../ManagerShell/managerNav'
import type { ManagerTab, NavGroup } from '../ManagerShell/managerNav'

export type BottomTab = ManagerTab

export interface BottomTabBarProps {
  tabs: BottomTab[]
  // Used to resolve which tab is active for the current route (a nested match route keeps Matches lit).
  groups: NavGroup[]
  menuOpen?: boolean
  onMenuClick: () => void
  // Count badge per tab id (e.g. polls).
  badges?: Record<string, number>
}

// docs/specs/079-manager-shell-and-overview.md: the phone bottom bar, below md. The last button is
// always Menu, opening the MenuSheet; it reads as active while the sheet is open.
export function BottomTabBar({ tabs, groups, menuOpen = false, onMenuClick, badges = {} }: BottomTabBarProps) {
  const { pathname } = useLocation()
  const activeId = menuOpen ? undefined : activeTabId(groups, pathname)

  const itemSx = (active: boolean) => ({
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 0.25,
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    px: 0.5,
    py: 0.5,
    border: 0,
    bgcolor: 'transparent',
    font: 'inherit',
    fontSize: '0.66rem',
    fontWeight: active ? 700 : 400,
    color: active ? 'primary.dark' : 'text.secondary',
    textDecoration: 'none',
    cursor: 'pointer',
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
  })

  return (
    <Paper
      component="nav"
      aria-label="Manager tabs"
      square
      elevation={0}
      sx={{
        display: 'flex',
        borderTop: 1,
        borderColor: 'divider',
        pb: 'env(safe-area-inset-bottom)',
        position: 'sticky',
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId
        const badge = badges[tab.id]
        return (
          <Box key={tab.id} component={RouterLink} to={tab.to} aria-current={active ? 'page' : undefined} sx={itemSx(active)}>
            <NavItemIcon name={tab.icon} size={32} padding={3} />
            {tab.label}
            {typeof badge === 'number' && badge > 0 && (
              <Box
                component="span"
                data-testid={`badge-${tab.id}`}
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: '50%',
                  mr: -2.5,
                  minWidth: 16,
                  px: 0.5,
                  borderRadius: 99,
                  bgcolor: 'error.main',
                  color: 'error.contrastText',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  lineHeight: '16px',
                  textAlign: 'center',
                }}
              >
                {badge}
              </Box>
            )}
          </Box>
        )
      })}
      <Box component="button" type="button" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={onMenuClick} sx={itemSx(menuOpen)}>
        <NavItemIcon name="menu" size={32} padding={3} />
        Menu
      </Box>
    </Paper>
  )
}
