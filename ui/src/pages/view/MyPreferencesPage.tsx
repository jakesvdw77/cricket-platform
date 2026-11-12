import { Box, Switch, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { HubFooterButton, HubFrame } from './myPlayers/HubFrame'
import { useHubFlag } from './myPlayers/hubPreferences'
import { HUB } from './myPlayers/hubStyle'
import { useHubTickerPreference } from './myPlayers/useHubTickerPreference'
import { MENU_AUTO_COLLAPSE_KEY } from './myPlayers/useHubMenuAutoCollapse'
import { blackAlpha } from '../../brandTokens'

// The person-level Preferences page (owner, 2026-11-06), reached from the Account page. Per-device switches only: nothing here is stored on the
// server, so signing in on another device starts with the defaults.
function PreferenceRow({ id, title, help, checked, onChange }: { id: string; title: string; help: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5, bgcolor: blackAlpha(0.3), border: 1, borderColor: HUB.line, borderRadius: '4px' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography id={`${id}-label`} sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 24, lineHeight: 1.1, letterSpacing: '.04em', textTransform: 'uppercase', color: HUB.cream }}>
          {title}
        </Typography>
        <Typography id={`${id}-help`} fontSize={15} sx={{ color: HUB.muted, mt: 0.5 }}>
          {help}
        </Typography>
      </Box>
      <Switch
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        inputProps={{ 'aria-labelledby': `${id}-label`, 'aria-describedby': `${id}-help` }}
        sx={{
          '& .MuiSwitch-switchBase.Mui-checked': { color: HUB.gold },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: HUB.gold },
          '& .MuiSwitch-track': { bgcolor: alpha(HUB.cream, 0.4) },
          '& .Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
        }}
      />
    </Box>
  )
}

export default function MyPreferencesPage() {
  const navigate = useNavigate()
  const [ticker, setTicker] = useHubTickerPreference()
  const [autoCollapse, setAutoCollapse] = useHubFlag(MENU_AUTO_COLLAPSE_KEY, false)
  return (
    <HubFrame
      title="Preferences"
      panel="clear"
      glass={0.4}
      maxWidth={960}
      testId="my-preferences-page"
      footer={<HubFooterButton onClick={() => navigate('/account/options')}>Back to account</HubFooterButton>}
    >
      <Typography sx={{ color: HUB.muted }}>These are kept on this device. Signing in on another device starts with the defaults.</Typography>
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <PreferenceRow
          id="pref-ticker"
          title="Scoreboard ticker"
          help="The rolling news line along the bottom of the Player Hub: results, live matches, upcoming matches and poll deadlines."
          checked={ticker}
          onChange={setTicker}
        />
        <PreferenceRow
          id="pref-menu"
          title="Collapse the menu automatically"
          help="Tucks the Player Hub menu away after 10 seconds so the page gets the space. Off by default; the collapse and pin buttons work either way. Wide screens only."
          checked={autoCollapse}
          onChange={setAutoCollapse}
        />
      </Box>
    </HubFrame>
  )
}
