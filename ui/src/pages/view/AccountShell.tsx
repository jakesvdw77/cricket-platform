import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { Avatar, Badge, Box, Button, IconButton, Menu, MenuItem, Typography, useMediaQuery, useTheme } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useClubHome } from './myPlayers/useClubHome'
import { hubPath } from './myPlayers/hubNav'
import { useMyInvitations, useMyLinkRequests } from '../../api/meApi'
import { ProfileSwitcher } from '../../components/ProfileSwitcher'
import { BrandMark } from '../../components/BrandMark'
import { useProfileSwitch } from '../../hooks/useProfileSwitch'
import { BACKDROP_COLOURS, PageBackdrop } from '../../components/PageBackdrop'
import { keycloak } from '../../auth/keycloak'
import { signOut } from '../../auth/signOut'
import { BRAND, creamAlpha, DARK_MENU_BG } from '../../brandTokens'
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
  const [switchAnchor, setSwitchAnchor] = useState<HTMLElement | null>(null)
  const profileItems = useProfileSwitch()
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
  const outline = { minHeight: 32, color: BACKDROP_COLOURS.cream, borderColor: BACKDROP_COLOURS.cream, bgcolor: 'transparent', '&:hover': { borderColor: BACKDROP_COLOURS.cream, bgcolor: creamAlpha(0.12), backgroundImage: 'none' } }
  return (
    <PageBackdrop>
      <Box component="header" sx={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, gap: 1, color: BACKDROP_COLOURS.cream }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BrandMark size={28} />
          <Typography fontWeight={700} fontSize={16}>
            Cricket Legend
          </Typography>
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
              {backTo && (
                <MenuItem
                  onClick={() => {
                    setAnchor(null)
                    navigate(backTo)
                  }}
                >
                  Back to club
                </MenuItem>
              )}
              {profileItems && (
                <MenuItem
                  onClick={() => {
                    setSwitchAnchor(anchor)
                    setAnchor(null)
                  }}
                >
                  Switch profile
                </MenuItem>
              )}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Badge badgeContent={pending} sx={badgeSx} invisible={pending === 0} data-testid="account-pending">
            <Button variant="outlined" size="small" sx={outline} aria-haspopup="menu" onClick={(event) => setAccountAnchor(event.currentTarget)}>
              Account
            </Button>
          </Badge>
          <Menu
            anchorEl={accountAnchor}
            open={Boolean(accountAnchor)}
            onClose={() => setAccountAnchor(null)}
            PaperProps={{ sx: { bgcolor: DARK_MENU_BG, color: BACKDROP_COLOURS.cream, border: `1px solid ${creamAlpha(0.28)}` } }}
          >
            {accountEntries(() => setAccountAnchor(null))}
          </Menu>
          {backTo && (
            <Button variant="outlined" size="small" startIcon={<ArrowBackIcon />} sx={outline} onClick={() => navigate(backTo)}>
              Back to club
            </Button>
          )}
          {profileItems && (
            <Button variant="outlined" size="small" sx={outline} onClick={(event) => setSwitchAnchor(event.currentTarget)}>
              Switch profile
            </Button>
          )}
          <Button variant="outlined" size="small" sx={outline} onClick={() => {
            forgetProfileChoices()
            signOut()
          }}>
            Sign out
          </Button>
        </Box>
        )}
        {profileItems && <ProfileSwitcher dark items={profileItems} anchorEl={switchAnchor} onClose={() => setSwitchAnchor(null)} />}
      </Box>
      <Box sx={{ width: '100%', maxWidth, mx: 'auto', boxSizing: 'border-box', ...(fill ? { px: { xs: 0, sm: 2 }, pt: { xs: 0, sm: 2 }, pb: { xs: 0, sm: 3 } } : { px: 2, py: { xs: 2, sm: 4 } }) }}>
        <Box
          data-testid={testId}
          sx={bare ? { color: BACKDROP_COLOURS.cream } : { bgcolor: 'background.paper', color: 'text.primary', borderRadius: 2, boxShadow: 1, p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {children}
        </Box>
      </Box>
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
