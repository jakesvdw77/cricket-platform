import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Avatar, Box, Divider, IconButton, Menu, MenuItem, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import { avatarSx } from '../RecordCard'
import { initialsFromName } from '../../utils/initials'

export interface AvatarMenuProps {
  name: string
  email?: string
  profileTo?: string
  onLogout: () => void
  // docs/specs/079: for a club-colour (tone="brand") header, where the default primary avatar would
  // vanish into its own background; renders a translucent contrast-text disc instead.
  onBrand?: boolean
}

export function AvatarMenu({ name, email, profileTo = '/profile', onLogout, onBrand }: AvatarMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
  const handleClose = () => setAnchorEl(null)

  return (
    <>
      <IconButton onClick={handleOpen} aria-label="Account menu" size="small">
        <Avatar
          sx={{
            ...avatarSx(32, '0.75rem'),
            ...(onBrand && {
              bgcolor: (theme) => alpha(theme.palette.primary.contrastText, 0.2),
              color: 'primary.contrastText',
            }),
          }}
        >{initialsFromName(name)}</Avatar>
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
