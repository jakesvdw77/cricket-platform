import type { ReactNode } from 'react'
import { Avatar, Box, IconButton, Tooltip, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { AvatarMenu } from '../AvatarMenu'
import type { ProfileSwitchItem } from '../ProfileSwitcher'
import { avatarSx } from '../RecordCard'
import { initialsFromName } from '../../utils/initials'

export interface ShellHeaderProps {
  brand: string
  user: { name: string; email?: string }
  onLogout: () => void
  profileTo: string
  /** Extra content before the brand — e.g. AppShell's mobile menu button. */
  leading?: ReactNode
  /** Tighter padding/type scale, for shells with less vertical room (e.g. BottomTabShell). */
  dense?: boolean
  // Makes the brand a link back to this persona's home route. Optional (undefined renders plain,
  // non-interactive text, unchanged from before this existed) so any caller that genuinely has no
  // "home" to return to isn't forced into one — but the manager shell's brand link is how a page
  // like ClubContactList gets back to /manage (found via manual testing of
  // docs/specs/021-club-contacts.md).
  homeTo?: string
  // The club's own logo, shown to the left of `brand` — undefined (the platform admin shell,
  // AppShell, and the still-mock PlayerHome/BottomTabShell) renders no avatar at all, unchanged
  // from before this existed. Passing this with a null value (a real club with no logo uploaded
  // yet) still renders the avatar, falling back to initialsFromName(brand) — same photo-or-
  // initials treatment RecordCard's own avatar slot already established for Team/Sponsor/Club
  // Contact, reused here rather than inventing a second convention for "no logo yet".
  logoUrl?: string | null
  // Renders a bell icon button (aria-label "Notifications") linking here, just before the profile
  // icon. Undefined renders no bell, so only the shell that passes it (the manager shell) has one.
  // For now it opens the sending page; receiving notifications is a later feature.
  notificationsTo?: string
  // Passed to AvatarMenu: shows a "My players" item when set.
  myPlayersTo?: string
  profileItems?: ProfileSwitchItem[]
}

// The header row (brand + AvatarMenu) shared by every post-login shell — see
// docs/specs/006-post-login-home-shells.md. docs/specs/120: it is the platform chrome for every shell and every club (dark
// green, cream text, the club logo on a white tile, a gold account disc); the club's identity here is its name and logo only. Pulled out once AppShell, ManagerShell, and
// BottomTabShell all turned out to render the same row, differing only in what nav they wrap
// it with (sidebar drawer, nothing, or a bottom tab bar).
const brandNameSx = {
  fontFamily: (theme: Theme) => theme.typography.fontFamilyDisplay,
  fontWeight: 600,
  fontSize: 19,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
} as const

export function ShellHeader({ brand, user, onLogout, profileTo, leading, dense, homeTo, logoUrl, notificationsTo, myPlayersTo, profileItems }: ShellHeaderProps) {
  const hasLogoSlot = logoUrl !== undefined

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: dense ? 2 : { xs: 2, md: 3 },
        py: dense ? 1.5 : 2,
        bgcolor: 'chrome.header',
        color: 'chrome.text',
        minHeight: { xs: 56, md: 64 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        {leading}
        {hasLogoSlot && (
          <Avatar
            src={logoUrl ?? undefined}
            variant="rounded"
            sx={{
              ...avatarSx(dense ? 28 : 32, '0.6875rem'),
              // The logo always sits on a white 6 px tile (docs/specs/120 Decision 18), so a white-on-transparent logo is never bare.
              bgcolor: 'background.paper',
              backgroundImage: 'none',
              color: 'chrome.header',
              borderRadius: '6px',
              '& img': { objectFit: 'contain', p: 0.25 },
            }}
          >
            {initialsFromName(brand)}
          </Avatar>
        )}
        <Typography
          variant={dense ? 'subtitle2' : 'subtitle1'}
          noWrap
          sx={homeTo ? { ...brandNameSx, color: 'inherit', textDecoration: 'none', '&:focus-visible': { outline: '2px solid', outlineColor: 'chrome.text', outlineOffset: 2 } } : brandNameSx}
          {...(homeTo && { component: RouterLink, to: homeTo })}
        >
          {brand}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        {notificationsTo && (
          <Tooltip title="Notifications">
            <IconButton
              component={RouterLink}
              to={notificationsTo}
              aria-label="Notifications"
              size="small"
              sx={{ color: 'chrome.text', p: 0.5, '&:focus-visible': { outline: '2px solid', outlineColor: 'chrome.text', outlineOffset: 2 } }}
            >
              <NotificationsOutlined sx={{ fontSize: 28 }} />
            </IconButton>
          </Tooltip>
        )}
        <AvatarMenu name={user.name} email={user.email} onLogout={onLogout} profileTo={profileTo} onBrand myPlayersTo={myPlayersTo} profileItems={profileItems} />
      </Box>
    </Box>
  )
}
