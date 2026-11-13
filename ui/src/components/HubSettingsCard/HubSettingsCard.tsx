import { Stack, Typography } from '@mui/material'
import { ToolbarToggleChip } from '../ToolbarCard'
import type { HubSettings } from '../../api/hubSettingsApi'
import { errorDetail } from '../../utils/errorDetail'

export interface HubSettingsCardProps {
  // Undefined while the switches load; the chips are then disabled and off.
  settings: HubSettings | undefined
  // Called with the whole new set; the caller saves it.
  onChange: (next: HubSettings) => void
  disabled?: boolean
  // The failed save, whose server message is shown.
  error?: unknown
}

type Flag = keyof HubSettings

const TOP: { flag: Flag; label: string }[] = [
  { flag: 'identityShown', label: 'Show Club Details' },
  { flag: 'contactShown', label: 'Show Club Phone And Email' },
  { flag: 'linksShown', label: 'Show Website And Social Links' },
  { flag: 'logosShown', label: 'Show Logos' },
  { flag: 'logoDownloadAllowed', label: 'Allow Logo Download' },
  { flag: 'directoryShown', label: 'Show Contact Directory' },
]

const DIRECTORY: { flag: Flag; label: string }[] = [
  { flag: 'directoryPhoneShown', label: 'Show Phone Numbers' },
  { flag: 'directoryEmailShown', label: 'Show Email Addresses' },
]

// docs/specs/148 (Manager side): what parents and players of the club see in the Player Hub. An on/off choice is a toggle chip,
// not a loose switch (page-anatomy.md). Administrators only (the caller decides who sees it).
export function HubSettingsCard({ settings, onChange, disabled = false, error }: HubSettingsCardProps) {
  const isOn = (flag: Flag) => settings?.[flag] ?? false
  const toggle = (flag: Flag, on: boolean) => {
    if (!settings) return
    const next = { ...settings, [flag]: on }
    onChange(flag === 'directoryShown' && !on ? { ...next, directoryPhoneShown: false, directoryEmailShown: false } : next)
  }
  const locked = disabled || !settings
  const directoryOff = !isOn('directoryShown')

  return (
    <Stack spacing={1.5} data-testid="hub-settings">
      <Typography variant="body2" color="text.secondary">
        Parents and players of this club see what is switched on. The directory shows all of the club&apos;s active contacts, adults only, once it is switched on.
      </Typography>
      <Stack component="fieldset" spacing={0} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
        <Typography component="legend" variant="subtitle2" sx={{ p: 0, mb: 0.5 }}>
          Shown In The Player Hub
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
          {TOP.map(({ flag, label }) => (
            <ToolbarToggleChip key={flag} label={label} pressed={isOn(flag)} disabled={locked} onChange={(next) => toggle(flag, next)} />
          ))}
        </Stack>
        <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap sx={{ pl: { xs: 2, sm: 3 }, mt: 1 }}>
          {DIRECTORY.map(({ flag, label }) => (
            <ToolbarToggleChip key={flag} label={label} pressed={isOn(flag)} disabled={locked || directoryOff} onChange={(next) => toggle(flag, next)} />
          ))}
        </Stack>
        {directoryOff && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: { xs: 2, sm: 3 }, mt: 0.5 }}>
            Turn on the contact directory first.
          </Typography>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Existing clubs start with their details visible.
      </Typography>
      {error !== undefined && error !== null && (
        <Typography variant="caption" color="error" role="alert">
          {errorDetail(error, 'Could not save the Player Hub settings.')}
        </Typography>
      )}
    </Stack>
  )
}
