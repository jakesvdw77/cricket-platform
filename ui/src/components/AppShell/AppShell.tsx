import { useState } from 'react'
import type { ReactNode } from 'react'
import { AppBar, Box, Drawer, IconButton, List, ListItemButton, ListItemText, Toolbar, Typography } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { AvatarMenu } from '../AvatarMenu'
import { Footer } from '../Footer'

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
  children: ReactNode
}

// Desktop-console layout: persistent sidebar + top bar. Below `md`, the sidebar becomes a
// temporary drawer behind a menu button rather than a bottom-tab bar — see
// docs/specs/006-post-login-home-shells.md's System Admin nav decision.
export function AppShell({ brand, navItems, user, onLogout, children }: AppShellProps) {
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
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              aria-label="Open navigation"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="subtitle1" fontWeight={700}>
              {brand}
            </Typography>
          </Box>
          <AvatarMenu name={user.name} email={user.email} onLogout={onLogout} />
        </Toolbar>
      </AppBar>

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
