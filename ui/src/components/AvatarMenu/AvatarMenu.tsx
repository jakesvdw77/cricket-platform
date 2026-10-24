import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Avatar, Box, Divider, IconButton, Menu, MenuItem, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { avatarSx } from '../RecordCard'
import { BRAND, darkMenuProps } from '../../brandTokens'
import { ProfileSwitcher } from '../ProfileSwitcher'
import type { ProfileSwitchItem } from '../ProfileSwitcher'
import { initialsFromName } from '../../utils/initials'

export interface AvatarMenuProps {
  name: string
  email?: string
  profileTo?: string
  onLogout: () => void
  // docs/specs/079, 120: set on the dark platform header; the account dropdown takes the dark look of the player console
  // (the avatar disc is gold everywhere).
  onBrand?: boolean
  // docs/specs/119 3C: additive item for a person who also has players (their own record or linked ones). Undefined renders nothing.
  myPlayersTo?: string
  // docs/specs/119 slice 4: more than one profile card adds "Switch profile". Undefined or a single card renders nothing.
  profileItems?: ProfileSwitchItem[]
}

export function AvatarMenu({ name, email, profileTo = '/profile', onLogout, onBrand, myPlayersTo, profileItems }: AvatarMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [switchAnchor, setSwitchAnchor] = useState<HTMLElement | null>(null)

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
  const handleClose = () => setAnchorEl(null)

  return (
    <>
      <IconButton onClick={handleOpen} aria-label="Account menu" size="small" sx={{ '&:focus-visible': { outline: '2px solid', outlineColor: onBrand ? 'chrome.text' : 'primary.main', outlineOffset: 2 } }}>
        <Avatar sx={avatarSx(32, '0.75rem')}>{initialsFromName(name)}</Avatar>
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose} {...(onBrand ? darkMenuProps : {})}>
        <Box sx={{ px: 2, py: 1, minWidth: 180 }}>
          <Typography variant="subtitle2">{name}</Typography>
          {email && (
            <Typography variant="caption" color={onBrand ? 'inherit' : 'text.secondary'} sx={onBrand ? { display: 'block', opacity: 0.8 } : undefined}>
              {email}
            </Typography>
          )}
        </Box>
        <Divider sx={onBrand ? { borderColor: 'chrome.menuLine' } : undefined} />
        <MenuItem component={RouterLink} to={profileTo} onClick={handleClose}>
          Profile
        </MenuItem>
        {myPlayersTo && (
          <MenuItem component={RouterLink} to={myPlayersTo} onClick={handleClose}>
            Player Hub
          </MenuItem>
        )}
        {profileItems && profileItems.length > 1 && (
          <MenuItem
            onClick={() => {
              setSwitchAnchor(anchorEl)
              handleClose()
            }}
          >
            Switch profile
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            handleClose()
            onLogout()
          }}
          sx={{ color: onBrand ? BRAND.errorOnDark : 'error.main' }}
        >
          Log out
        </MenuItem>
      </Menu>
      {profileItems && profileItems.length > 1 && <ProfileSwitcher items={profileItems} anchorEl={switchAnchor} onClose={() => setSwitchAnchor(null)} />}
    </>
  )
}
