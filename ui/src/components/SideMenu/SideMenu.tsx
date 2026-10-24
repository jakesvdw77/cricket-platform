import { Box, Tooltip, Typography } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { CHROME } from '../../brandTokens'
import { displayLabelSx } from '../../theme'
import { NavItemIcon } from '../NavItemIcon'
import { activeNavId } from '../ManagerShell/managerNav'
import type { NavGroup, NavItem } from '../ManagerShell/managerNav'

export interface SideMenuProps {
  groups: NavGroup[]
  // Icons-only rail (md to lg): label as tooltip and aria-label, badges as a small count dot.
  collapsed?: boolean
  // Count badge per item id (e.g. open polls). Zero or missing renders nothing.
  badges?: Record<string, number>
  'aria-label'?: string
}

// docs/specs/079-manager-shell-and-overview.md: the manager's persistent menu, grouped, with the
// active row (by route prefix, see managerNav) marked. docs/specs/120: the platform chrome, dark green for every club, labels in
// the display face, the active row gold text on a gold tint (and bold, with aria-current, so it is never colour alone), brand
// icons on a cream tile.
export function SideMenu({ groups, collapsed = false, badges = {}, 'aria-label': ariaLabel = 'Manager' }: SideMenuProps) {
  const { pathname } = useLocation()
  const activeId = activeNavId(groups, pathname)

  return (
    <Box
      component="nav"
      aria-label={ariaLabel}
      sx={{
        width: collapsed ? 64 : 232,
        flex: 'none',
        bgcolor: 'chrome.menu',
        color: 'chrome.text',
        borderRight: 1,
        borderColor: 'chrome.menuLine',
        px: 1,
        py: 1.25,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
      }}
    >
      {groups.map((group, index) => (
        <Box key={group.label ?? `group-${index}`} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {group.label &&
            (collapsed ? (
              <Box aria-hidden sx={{ borderTop: 1, borderColor: 'chrome.menuLine', mx: 1, my: 1 }} />
            ) : (
              <Typography
                variant="overline"
                color="inherit"
                sx={{ ...displayLabelSx, px: 1, pt: 1.5, pb: 0.5, fontSize: 11, letterSpacing: '0.12em', lineHeight: 1.5, opacity: 0.7 }}
              >
                {group.label}
              </Typography>
            ))}
          {group.items.map((item) => (
            <SideMenuRow key={item.id} item={item} active={item.id === activeId} collapsed={collapsed} badge={badges[item.id]} />
          ))}
        </Box>
      ))}
    </Box>
  )
}

function SideMenuRow({ item, active, collapsed, badge }: { item: NavItem; active: boolean; collapsed: boolean; badge?: number }) {
  const hasBadge = typeof badge === 'number' && badge > 0
  const link = (
    <Box
      component={RouterLink}
      to={item.to}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? (hasBadge ? `${item.label}, ${badge}` : item.label) : undefined}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 1.25,
        px: collapsed ? 0 : 1,
        py: 0.5,
        borderRadius: 1,
        ...displayLabelSx,
        color: active ? 'chrome.selected' : 'chrome.text',
        fontWeight: active ? 700 : 600,
        fontSize: 17,
        textDecoration: 'none',
        bgcolor: active ? 'chrome.selectedBg' : 'transparent',
        '&:hover': { bgcolor: active ? 'chrome.selectedBg' : 'chrome.hover' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'chrome.text', outlineOffset: 2 },
        '@media (prefers-reduced-motion: no-preference)': { transition: 'background-color 120ms ease' },
      }}
    >
      <NavItemIcon name={item.icon} size={32} padding={2} onDark />
      {!collapsed && <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{item.label}</Box>}
      {hasBadge && (
        <Box
          component="span"
          data-testid={`badge-${item.id}`}
          aria-hidden={collapsed ? true : undefined}
          sx={{
            ...(collapsed ? { position: 'absolute', top: 2, right: 2 } : { ml: 'auto' }),
            minWidth: 18,
            px: 0.75,
            borderRadius: 99,
            bgcolor: 'error.main',
            color: 'error.contrastText',
            boxShadow: `0 0 0 1.5px ${CHROME.text}`,
            fontFamily: (theme) => theme.typography.fontFamily,
            letterSpacing: 0,
            textTransform: 'none',
            fontSize: '0.68rem',
            fontWeight: 700,
            lineHeight: '18px',
            textAlign: 'center',
          }}
        >
          {badge}
        </Box>
      )}
    </Box>
  )

  return collapsed ? (
    <Tooltip title={item.label} placement="right">
      {link}
    </Tooltip>
  ) : (
    link
  )
}
