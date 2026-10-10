import type { ReactNode } from 'react'
import { Avatar, Box, IconButton, Tooltip, Typography } from '@mui/material'
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { AvatarMenu } from '../AvatarMenu'
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
  // docs/specs/079-manager-shell-and-overview.md: opt-in club-colour header (solid primary.main,
  // primary.contrastText, logo on a white tile). Undefined/'plain' is the white header the admin and
  // player shells keep unchanged.
  tone?: 'plain' | 'brand'
  // Renders a bell icon button (aria-label "Notifications") linking here, just before the profile
  // icon. Undefined renders no bell, so only the shell that passes it (the manager shell) has one.
  // For now it opens the sending page; receiving notifications is a later feature.
  notificationsTo?: string
}

// The header row (brand + AvatarMenu) shared by every post-login shell — see
// docs/specs/006-post-login-home-shells.md. Pulled out once AppShell, ManagerShell, and
// BottomTabShell all turned out to render the same row, differing only in what nav they wrap
// it with (sidebar drawer, nothing, or a bottom tab bar).
export function ShellHeader({ brand, user, onLogout, profileTo, leading, dense, homeTo, logoUrl, tone = 'plain', notificationsTo }: ShellHeaderProps) {
  const hasLogoSlot = logoUrl !== undefined
  const onBrand = tone === 'brand'

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: dense ? 2 : { xs: 2, md: 3 },
        py: dense ? 1.5 : 2,
        ...(onBrand
          ? { bgcolor: 'primary.main', color: 'primary.contrastText', minHeight: { xs: 56, md: 64 } }
          : { borderBottom: 1, borderColor: 'divider' }),
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
              ...(onBrand && { bgcolor: 'background.paper', color: 'primary.dark', fontWeight: 700 }),
            }}
          >
            {initialsFromName(brand)}
          </Avatar>
        )}
        <Typography
          variant={dense ? 'subtitle2' : 'subtitle1'}
          fontWeight={700}
          noWrap
          {...(homeTo && {
            component: RouterLink,
            to: homeTo,
            sx: { color: 'inherit', textDecoration: 'none' },
          })}
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
              sx={{ color: onBrand ? 'primary.contrastText' : 'text.secondary', p: 0.5 }}
            >
              <NotificationsOutlined sx={{ fontSize: 28 }} />
            </IconButton>
          </Tooltip>
        )}
        <AvatarMenu name={user.name} email={user.email} onLogout={onLogout} profileTo={profileTo} onBrand={onBrand} />
      </Box>
    </Box>
  )
}
