import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Backdrop, Box, ButtonBase, Fab, Fade, ListItemIcon, ListItemText, Menu, MenuItem, useMediaQuery, useTheme } from '@mui/material'
import Add from '@mui/icons-material/Add'
import Close from '@mui/icons-material/Close'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import { BrandIcon } from '../BrandIcon'
import type { BrandIconName } from '../BrandIcon'
import { Button } from '../Button'

export interface QuickAction {
  id: string
  label: string
  to: string
  icon: BrandIconName
}

export interface QuickActionsProps {
  // Already filtered by the caller to the actions the user may take.
  actions: QuickAction[]
}

// Phone bottom tab bar: 32 px icon + 2 x 3 px padding + label + 2 x 4 px padding is about 64 px;
// 16 px of air on top of that (plus the safe-area inset, which the bar pads itself with).
const PHONE_DIAL_BOTTOM = 'calc(80px + env(safe-area-inset-bottom))'

// docs/specs/079-manager-shell-and-overview.md "Quick actions control": from md an Actions button that
// opens a menu; below md a controlled round '+' button (own list, no hover/blur closing) above the bottom tab bar. Renders nothing when there are no actions.
export function QuickActions({ actions }: QuickActionsProps) {
  const theme = useTheme()
  const wide = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [dialOpen, setDialOpen] = useState(false)

  useEffect(() => {
    if (!dialOpen) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDialOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dialOpen])

  if (actions.length === 0) return null

  if (wide) {
    const open = Boolean(anchor)
    return (
      <>
        <Button
          variant="secondary"
          size="sm"
          id="quick-actions-button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? 'quick-actions-menu' : undefined}
          endIcon={<KeyboardArrowDown />}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{ flex: 'none' }}
        >
          Actions
        </Button>
        <Menu
          id="quick-actions-menu"
          anchorEl={anchor}
          open={open}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          MenuListProps={{ 'aria-labelledby': 'quick-actions-button' }}
        >
          {actions.map((action) => (
            <MenuItem key={action.id} component={RouterLink} to={action.to} onClick={() => setAnchor(null)} sx={{ gap: 1.5, py: 1 }}>
              <ListItemIcon sx={{ minWidth: 0 }}>
                <BrandIcon name={action.icon} size={28} />
              </ListItemIcon>
              <ListItemText primary={action.label} />
            </MenuItem>
          ))}
        </Menu>
      </>
    )
  }

  return (
    <>
      <Backdrop
        open={dialOpen}
        onClick={() => setDialOpen(false)}
        data-testid="quick-actions-backdrop"
        sx={{ zIndex: theme.zIndex.speedDial - 1, bgcolor: 'rgba(0, 0, 0, 0.45)' }}
      />
      <Box
        sx={{
          position: 'fixed',
          right: 16,
          bottom: PHONE_DIAL_BOTTOM,
          zIndex: theme.zIndex.speedDial,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 1.5,
        }}
      >
        <Fade in={dialOpen} unmountOnExit>
          <Box component="nav" id="quick-actions-list" aria-label="Quick actions" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1.5 }}>
            {actions.map((action) => (
              <ButtonBase
                key={action.id}
                component={RouterLink}
                to={action.to}
                onClick={() => setDialOpen(false)}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, minHeight: 48, borderRadius: 6, textDecoration: 'none' }}
              >
                <Box
                  component="span"
                  sx={{
                    whiteSpace: 'nowrap',
                    px: 1.5,
                    py: 1,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'text.primary',
                    bgcolor: 'common.white',
                    boxShadow: 3,
                    borderRadius: 2,
                  }}
                >
                  {action.label}
                </Box>
                <Box
                  component="span"
                  sx={{ width: 46, height: 46, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', bgcolor: 'common.white', boxShadow: 3 }}
                >
                  <BrandIcon name={action.icon} size={32} surface="none" />
                </Box>
              </ButtonBase>
            ))}
          </Box>
        </Fade>
        <Fab
          color="primary"
          aria-label="Quick actions"
          aria-expanded={dialOpen}
          aria-controls={dialOpen ? 'quick-actions-list' : undefined}
          onClick={() => setDialOpen((value) => !value)}
        >
          {dialOpen ? <Close /> : <Add />}
        </Fab>
      </Box>
    </>
  )
}
