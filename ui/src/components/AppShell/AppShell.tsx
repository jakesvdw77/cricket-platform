import { useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Drawer, IconButton, List, ListItemButton, ListItemText } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { Footer } from '../Footer'
import { ShellHeader } from '../ShellHeader'

const DRAWER_WIDTH = 232

export interface AppShellNavItem {
  label: string
  to: string
}

export interface AppShellProps {
  brand: string
  navItems: AppShellNavItem[]
  user: { name: string; email?: string }
  onLogout: () => void
  profileTo: string
  children: ReactNode
}

// Desktop-console layout: persistent sidebar + top bar. Below `md`, the sidebar becomes a
// temporary drawer behind a menu button rather than a bottom-tab bar — see
// docs/specs/006-post-login-home-shells.md's System Admin nav decision.
export function AppShell({ brand, navItems, user, onLogout, profileTo, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const drawerList = (
    <List sx={{ pt: 1 }}>
      {navItems.map((item) => (
        <ListItemButton
          key={item.to}
          component={RouterLink}
          to={item.to}
          selected={location.pathname === item.to}
          onClick={() => setMobileOpen(false)}
        >
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ShellHeader
        brand={brand}
        user={user}
        onLogout={onLogout}
        profileTo={profileTo}
        leading={
          <IconButton
            aria-label="Open navigation"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
        }
      />

      <Box sx={{ display: 'flex', flex: 1 }}>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              position: 'relative',
              borderRight: 1,
              borderColor: 'divider',
            },
          }}
        >
          {drawerList}
        </Drawer>

        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
          }}
        >
          {drawerList}
        </Drawer>

        <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 }, minWidth: 0 }}>
          {children}
        </Box>
      </Box>

      <Footer />
    </Box>
  )
}
