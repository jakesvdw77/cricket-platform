import { Box, Typography } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { BottomSheet } from '../BottomSheet'
import { CHROME } from '../../brandTokens'
import { displayLabelSx } from '../../theme'
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
    <BottomSheet open={open} onOpen={onOpen} onClose={onClose} ariaLabel="Menu" title="Menu" closeLabel="Close menu" tone="dark">
      {groups.map((group, index) => (
        <Box key={group.label ?? `group-${index}`} sx={{ mb: 1 }}>
          {group.label && (
            <Typography variant="overline" color="inherit" sx={{ ...displayLabelSx, display: 'block', fontSize: 11, letterSpacing: '0.12em', opacity: 0.7, pt: 1, pb: 0.5 }}>
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
                    // Dark raised panel, a gold outline when current (docs/specs/120).
                    bgcolor: 'chrome.hover',
                    outline: '2px solid',
                    outlineColor: active ? 'chrome.selected' : 'transparent',
                    color: active ? 'chrome.selected' : 'chrome.text',
                    textDecoration: 'none',
                    textAlign: 'center',
                    ...displayLabelSx,
                    fontSize: 15,
                    letterSpacing: '0.05em',
                    fontWeight: active ? 700 : 600,
                    '&:focus-visible': { outlineColor: 'chrome.text', outlineOffset: 2 },
                  }}
                >
                  <NavItemIcon name={item.icon} size={40} onDark />
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
                        boxShadow: `0 0 0 1.5px ${CHROME.text}`,
                        fontFamily: (theme) => theme.typography.fontFamily,
                        letterSpacing: 0,
                        textTransform: 'none',
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
