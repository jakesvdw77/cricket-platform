import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Avatar, Box, Divider, IconButton, Menu, MenuItem, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export interface AvatarMenuProps {
  name: string
  email?: string
  profileTo?: string
  onLogout: () => void
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function AvatarMenu({ name, email, profileTo = '/profile', onLogout }: AvatarMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
  const handleClose = () => setAnchorEl(null)

  return (
    <>
      <IconButton onClick={handleOpen} aria-label="Account menu" size="small">
        <Avatar sx={{ width: 32, height: 32, fontSize: '0.75rem', fontWeight: 600, bgcolor: 'primary.main' }}>
          {initialsOf(name)}
        </Avatar>
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        <Box sx={{ px: 2, py: 1, minWidth: 180 }}>
          <Typography variant="subtitle2">{name}</Typography>
          {email && (
            <Typography variant="caption" color="text.secondary">
              {email}
            </Typography>
          )}
        </Box>
        <Divider />
        <MenuItem component={RouterLink} to={profileTo} onClick={handleClose}>
          Profile
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose()
            onLogout()
          }}
          sx={{ color: 'error.main' }}
        >
          Log out
        </MenuItem>
      </Menu>
    </>
  )
}
