import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Avatar, Box, Button, IconButton, Menu, MenuItem, Typography, useMediaQuery, useTheme } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useClubHome } from './myPlayers/useClubHome'
import { ProfileSwitcher } from '../../components/ProfileSwitcher'
import { useProfileSwitch } from '../../hooks/useProfileSwitch'
import { BACKDROP_COLOURS, PageBackdrop } from '../../components/PageBackdrop'
import { keycloak } from '../../auth/keycloak'
import { creamAlpha, DARK_MENU_BG } from '../../brandTokens'
import { forgetProfileChoices } from '../../utils/activeProfile'

// The shared frame of the signed-in, not-in-the-manager-app pages (docs/specs/119): Find your players
// and My players. The cricket backdrop, a slim header with Sign out and one white card column.
export function AccountShell({ children, maxWidth = 592, testId = 'welcome-page', bare = false }: { children: ReactNode; maxWidth?: number; testId?: string; bare?: boolean }) {
  const navigate = useNavigate()
  const backTo = useClubHome()
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true })
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [switchAnchor, setSwitchAnchor] = useState<HTMLElement | null>(null)
  const profileItems = useProfileSwitch()
  const name = (keycloak.tokenParsed as { name?: string } | undefined)?.name ?? ''
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
  const outline = { minHeight: 32, color: BACKDROP_COLOURS.cream, borderColor: BACKDROP_COLOURS.cream, '&:hover': { borderColor: BACKDROP_COLOURS.cream, bgcolor: creamAlpha(0.12) } }
  return (
    <PageBackdrop>
      <Box component="header" sx={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, gap: 1, color: BACKDROP_COLOURS.cream }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="img" src="/favicon.svg" alt="" width={28} height={28} />
          <Typography fontWeight={700} fontSize={16}>
            Cricket Legend
          </Typography>
        </Box>
        {phone ? (
          <>
            <IconButton aria-label="Account menu" onClick={(event) => setAnchor(event.currentTarget)} sx={{ p: 0.5 }}>
              <Avatar sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700, bgcolor: creamAlpha(0.2), color: BACKDROP_COLOURS.cream }}>{initials}</Avatar>
            </IconButton>
            <Menu
              anchorEl={anchor}
              open={Boolean(anchor)}
              onClose={() => setAnchor(null)}
              PaperProps={{ sx: { bgcolor: DARK_MENU_BG, color: BACKDROP_COLOURS.cream, border: `1px solid ${creamAlpha(0.28)}` } }}
            >
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
                  keycloak.logout()
                }}
              >
                Sign out
              </MenuItem>
            </Menu>
          </>
        ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
            keycloak.logout()
          }}>
            Sign out
          </Button>
        </Box>
        )}
        {profileItems && <ProfileSwitcher dark items={profileItems} anchorEl={switchAnchor} onClose={() => setSwitchAnchor(null)} />}
      </Box>
      <Box sx={{ width: '100%', maxWidth, mx: 'auto', px: 2, py: { xs: 2, sm: 4 }, boxSizing: 'border-box' }}>
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
