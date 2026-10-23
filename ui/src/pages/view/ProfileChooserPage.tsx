import { useState } from 'react'
import { Alert, Box, ButtonBase, Checkbox, Chip, FormControlLabel, Skeleton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMyProfiles } from '../../api/meApi'
import type { Profile } from '../../api/meApi'
import { openProfile } from '../../utils/activeProfile'
import { HubFrame } from './myPlayers/HubFrame'
import { HUB } from './myPlayers/hubStyle'

// docs/specs/119 slice 4: /choose-profile, shown only to a person with more than one card: one "My players" card, one
// "Manager of <club>" card per club and, for a platform admin, "Platform admin". "Remember my choice" is off by default
// and only stores the choice on this device.
function ProfileCard({ profile, onChoose }: { profile: Profile; onChoose: () => void }) {
  const line = profile.subtitle ?? null
  return (
    <ButtonBase
      onClick={onChoose}
      sx={{
        width: '100%',
        minHeight: 112,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 0.5,
        p: 2.5,
        textAlign: 'left',
        bgcolor: 'rgba(0,0,0,.30)',
        border: 1,
        borderColor: HUB.line,
        borderRadius: '4px',
        color: HUB.cream,
        '&:hover': { borderColor: HUB.gold, bgcolor: alpha(HUB.gold, 0.1) },
        '&.Mui-focusVisible': { borderColor: HUB.gold, outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
        '@media (prefers-reduced-motion: no-preference)': { transition: 'background-color .15s, border-color .15s' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', width: '100%' }}>
        <Typography sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 30, lineHeight: 1.05, letterSpacing: '.04em', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
          {profile.title}
        </Typography>
        {profile.pendingCount > 0 && <Chip size="small" label={`${profile.pendingCount} pending`} sx={{ bgcolor: HUB.gold, color: HUB.ink, fontWeight: 700, height: 22 }} />}
      </Box>
      {line && (
        <Typography fontSize={15} sx={{ color: HUB.muted }}>
          {line}
        </Typography>
      )}
      {profile.kind === 'MANAGER' && profile.clubName && !line?.includes(profile.clubName) && (
        <Typography fontSize={13} sx={{ color: HUB.muted }}>
          {profile.clubName}
        </Typography>
      )}
    </ButtonBase>
  )
}

export default function ProfileChooserPage() {
  const navigate = useNavigate()
  const profiles = useMyProfiles()
  const [remember, setRemember] = useState(false)
  const list = profiles.data ?? []

  if (profiles.data && list.length === 1) return <Navigate to={list[0].landing} replace />
  if (profiles.data && list.length === 0) return <Navigate to="/welcome" replace />

  return (
    <HubFrame title="Choose Profile" maxWidth={720} testId="profile-chooser">
      {profiles.isLoading && (
        <Box aria-busy="true" aria-label="Loading your profiles" sx={{ display: 'grid', gap: 1.5 }}>
          <Skeleton variant="rounded" height={112} sx={{ bgcolor: 'rgba(247,243,232,.12)' }} />
          <Skeleton variant="rounded" height={112} sx={{ bgcolor: 'rgba(247,243,232,.12)' }} />
        </Box>
      )}
      {profiles.isError && <Alert severity="error">We could not load your profiles. Please try again later.</Alert>}
      {profiles.data && (
        <>
          <Typography sx={{ color: HUB.muted }}>How would you like to use Cricket Legend today?</Typography>
          <Box role="list" aria-label="Profiles" sx={{ display: 'grid', gap: 1.5 }}>
            {list.map((profile) => (
              <Box key={`${profile.kind}:${profile.clubId ?? ''}`} role="listitem" sx={{ display: 'flex' }}>
                <ProfileCard profile={profile} onChoose={() => openProfile(profile, navigate, remember)} />
              </Box>
            ))}
          </Box>
          <FormControlLabel
            control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} sx={{ color: HUB.muted, '&.Mui-checked': { color: HUB.gold } }} />}
            label="Remember my choice on this device"
            sx={{ color: HUB.cream, minHeight: 44 }}
          />
        </>
      )}
    </HubFrame>
  )
}
