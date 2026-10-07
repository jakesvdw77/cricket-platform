import { Box, Typography } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { BottomSheet } from '../BottomSheet'
import { NavItemIcon } from '../NavItemIcon'
import { activeNavId } from '../ManagerShell/managerNav'
import type { NavGroup } from '../ManagerShell/managerNav'

export interface MenuSheetProps {
  open: boolean
  onOpen: () => void
  onClose: () => void
  groups: NavGroup[]
  // Count badge per item id (e.g. open polls).
  badges?: Record<string, number>
}

// docs/specs/079-manager-shell-and-overview.md: the phone Menu sheet, on the shared BottomSheet
// (Escape, focus trap, backdrop tap and swipe-down come with it); choosing a destination closes it.
export function MenuSheet({ open, onOpen, onClose, groups, badges = {} }: MenuSheetProps) {
  const { pathname } = useLocation()
  const activeId = activeNavId(groups, pathname)

  return (
    <BottomSheet open={open} onOpen={onOpen} onClose={onClose} ariaLabel="Menu" title="Menu" closeLabel="Close menu">
      {groups.map((group, index) => (
        <Box key={group.label ?? `group-${index}`} sx={{ mb: 1 }}>
          {group.label && (
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem', pt: 1, pb: 0.5 }}>
              {group.label}
            </Typography>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {group.items.map((item) => {
              const badge = badges[item.id]
              const active = item.id === activeId
              return (
                <Box
                  key={item.id}
                  component={RouterLink}
                  to={item.to}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 0.5,
                    py: 1,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    boxShadow: 1,
                    outline: '2px solid',
                    outlineColor: active ? 'primary.main' : 'transparent',
                    color: 'text.primary',
                    textDecoration: 'none',
                    textAlign: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                  }}
                >
                  <NavItemIcon name={item.icon} size={40} />
                  {item.label}
                  {typeof badge === 'number' && badge > 0 && (
                    <Box
                      component="span"
                      data-testid={`badge-${item.id}`}
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 6,
                        minWidth: 18,
                        px: 0.75,
                        borderRadius: 99,
                        bgcolor: 'error.main',
                        color: 'error.contrastText',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        lineHeight: '18px',
                      }}
                    >
                      {badge}
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>
      ))}
    </BottomSheet>
  )
}
