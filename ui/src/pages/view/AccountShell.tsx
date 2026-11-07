import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { Avatar, Badge, Box, ButtonBase, IconButton, Menu, MenuItem, Typography, useMediaQuery, useTheme } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { BrandMark } from '../../components/BrandMark'
import { useClubHome } from './myPlayers/useClubHome'
import { hubPath } from './myPlayers/hubNav'
import { useMyInvitations, useMyLinkRequests } from '../../api/meApi'
import { BACKDROP_COLOURS, PageBackdrop } from '../../components/PageBackdrop'
import { keycloak } from '../../auth/keycloak'
import { signOut } from '../../auth/signOut'
import { BRAND, creamAlpha, DARK_MENU_BG, FONT_DISPLAY } from '../../brandTokens'
import { forgetProfileChoices } from '../../utils/activeProfile'

// The shared frame of the signed-in, not-in-the-manager-app pages (docs/specs/119): Find your players
// and Player Hub. The cricket backdrop, a slim header with Sign out and one white card column.
// `fill` (the Player Hub, docs/specs/121) drops the vertical padding so the console can fill the window height: nothing
// around it on a phone, 16 px above and 24 px below from sm. `maxWidth` may then be a responsive value.
const badgeSx = { '& .MuiBadge-badge': { bgcolor: BRAND.gold, color: BRAND.ink, fontWeight: 700 } } as const

export function AccountShell({
  children,
  maxWidth = 592,
  testId = 'welcome-page',
  bare = false,
  fill = false,
}: {
  children: ReactNode
  maxWidth?: number | string | Record<string, number | string>
  testId?: string
  bare?: boolean
  fill?: boolean
}) {
  const navigate = useNavigate()
  const backTo = useClubHome()
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true })
  // docs/specs/145: Invitations, Link Requests and Link More Players moved here from the Hub menu's Account item; the counts are the
  // same reads the Hub used for the old Account pills, and the avatar carries the total.
  const { key: playerKey } = useParams<{ key?: string }>()
  const invitations = useMyInvitations().data?.length ?? 0
  const linkRequests = (useMyLinkRequests().data ?? []).filter((request) => request.status === 'PENDING').length
  const pending = invitations + linkRequests
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null)
  const name = (keycloak.tokenParsed as { name?: string } | undefined)?.name ?? ''
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
  const withCount = (label: string, count: number) => (count > 0 ? `${label} (${count})` : label)
  // Menu items cannot sit in a Fragment (MUI Menu reads its children), so the entries are returned as an array.
  const accountEntries = (close: () => void) => [
    <MenuItem key="invitations" onClick={() => { close(); navigate(playerKey ? hubPath(playerKey, 'account', 'invitations') : '/account/invitations') }}>
      {withCount('Invitations', invitations)}
    </MenuItem>,
    <MenuItem key="requests" onClick={() => { close(); navigate(playerKey ? hubPath(playerKey, 'account', 'requests') : '/welcome') }}>
      {withCount('Link Requests', linkRequests)}
    </MenuItem>,
    <MenuItem key="find" onClick={() => { close(); navigate('/welcome') }}>
      Link More Players
    </MenuItem>,
  ]
  const quietLink = { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, letterSpacing: '0.14em', textTransform: 'uppercase', color: BACKDROP_COLOURS.cream, py: 0.75, borderBottom: '2px solid transparent', '&:hover': { borderBottomColor: BRAND.gold }, '&.Mui-focusVisible': { outline: `2px solid ${BRAND.gold}`, outlineOffset: 2 } } as const
  return (
    <PageBackdrop>
      {/* The Player Hub (fill) has no header row: Switch profile, Back to club and Sign out live under Account in its menu (owner, 2026-11-06). */}
      {!fill && <Box component="header" sx={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, gap: 1, color: BACKDROP_COLOURS.cream }}>
        {/* Owner, 2026-11-06: no brand mark here; Back to club is the quiet link at the left, and the controls at the right are plain text links. */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {backTo && (
            <ButtonBase onClick={() => navigate(backTo)} sx={quietLink}>
              <ArrowBackIcon sx={{ fontSize: 18, mr: 0.75 }} />
              Back to club
            </ButtonBase>
          )}
        </Box>
        {phone ? (
          <>
            <IconButton aria-label="Account menu" onClick={(event) => setAnchor(event.currentTarget)} sx={{ p: 0.5 }}>
              <Badge badgeContent={pending} sx={badgeSx} invisible={pending === 0} data-testid="account-pending">
                <Avatar sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700, bgcolor: creamAlpha(0.2), color: BACKDROP_COLOURS.cream }}>{initials}</Avatar>
              </Badge>
            </IconButton>
            <Menu
              anchorEl={anchor}
              open={Boolean(anchor)}
              onClose={() => setAnchor(null)}
              PaperProps={{ sx: { bgcolor: DARK_MENU_BG, color: BACKDROP_COLOURS.cream, border: `1px solid ${creamAlpha(0.28)}` } }}
            >
              {accountEntries(() => setAnchor(null))}
              <MenuItem
                onClick={() => {
                  setAnchor(null)
                  forgetProfileChoices()
                  signOut()
                }}
              >
                Sign out
              </MenuItem>
            </Menu>
          </>
        ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Badge badgeContent={pending} sx={badgeSx} invisible={pending === 0} data-testid="account-pending">
            <ButtonBase aria-haspopup="menu" sx={quietLink} onClick={(event) => setAccountAnchor(event.currentTarget)}>
              Account
            </ButtonBase>
          </Badge>
          <Menu
            anchorEl={accountAnchor}
            open={Boolean(accountAnchor)}
            onClose={() => setAccountAnchor(null)}
            PaperProps={{ sx: { bgcolor: DARK_MENU_BG, color: BACKDROP_COLOURS.cream, border: `1px solid ${creamAlpha(0.28)}` } }}
          >
            {accountEntries(() => setAccountAnchor(null))}
          </Menu>
          <ButtonBase sx={quietLink} onClick={() => {
            forgetProfileChoices()
            signOut()
          }}>
            Sign out
          </ButtonBase>
        </Box>
        )}
      </Box>}
      <Box sx={{ width: '100%', maxWidth, mx: 'auto', boxSizing: 'border-box', ...(fill ? { px: { xs: 0, sm: 2 }, pt: { xs: 0, sm: 2 }, pb: { xs: 0, sm: 3 } } : { px: 2, py: { xs: 2, sm: 4 } }) }}>
        <Box
          data-testid={testId}
          sx={bare ? { color: BACKDROP_COLOURS.cream } : { bgcolor: 'background.paper', color: 'text.primary', borderRadius: 2, boxShadow: 1, p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {children}
        </Box>
      </Box>
      {/* Owner, 2026-11-06: the brand sits bottom left and the copyright bottom right (not on the Player Hub console, which fills the window). */}
      {!fill && (
        <Box component="footer" sx={{ mt: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 2, py: 1.5, color: creamAlpha(0.72) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BrandMark size={24} />
            <Typography fontWeight={700} fontSize={14}>
              Cricket Legend
            </Typography>
          </Box>
          <Typography fontSize={12.5}>&copy; {new Date().getFullYear()} Cricket Legend. All rights reserved.</Typography>
        </Box>
      )}
    </PageBackdrop>
  )
}

export function AccountHeading({ children }: { children: ReactNode }) {
  return (
    <Typography variant="h5" component="h1" fontWeight={700} fontSize={22} lineHeight={1.25}>
      {children}
    </Typography>
  )
}
