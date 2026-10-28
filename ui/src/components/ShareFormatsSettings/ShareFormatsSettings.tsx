import { Stack, Typography } from '@mui/material'
import { CompactSwitch } from '../CompactSwitch'
import { FORMAT_CODES, offeredFormats } from '../../utils/share/enabledFormats'
import type { ShareContentType } from '../../utils/share/enabledFormats'
import { errorDetail } from '../../utils/errorDetail'

export interface ShareFormatsSettingsProps {
  // The settings map (`disabledFormats`): content type to the format codes the club switched off.
  disabledFormats: Record<string, string[]>
  // Called with the whole new map; the caller saves it.
  onChange: (next: Record<string, string[]>) => void
  disabled?: boolean
  // The failed save, whose server message (for example the last-format refusal) is shown.
  error?: unknown
}

const GROUPS: { type: ShareContentType; title: string }[] = [
  { type: 'RESULT', title: 'Results' },
  { type: 'LEAGUE', title: 'Leagues' },
]

const LABELS: Record<string, string> = {
  PDF: 'PDF',
  IMAGE: 'Image',
  TV: 'TV summary',
  POSTER: 'Poster',
  CALENDAR: 'Calendar',
  WHATSAPP: 'WhatsApp',
  FACEBOOK: 'Facebook',
}

// docs/specs/122-league-sharing.md (Share formats): one switch per format for each content type, administrators only (the
// caller decides who sees it). The last format on for a content type cannot be switched off; the server enforces the same.
export function ShareFormatsSettings({ disabledFormats, onChange, disabled = false, error }: ShareFormatsSettingsProps) {
  const toggle = (type: ShareContentType, code: string, on: boolean) => {
    const off = new Set(disabledFormats[type] ?? [])
    if (on) off.delete(code)
    else off.add(code)
    onChange({ ...disabledFormats, [type]: FORMAT_CODES[type].filter((c) => off.has(c)) })
  }

  return (
    <Stack spacing={1.5} data-testid="share-formats-settings">
      <Typography variant="body2" color="text.secondary">
        Choose which formats managers can use when sharing. Administrators only.
      </Typography>
      {GROUPS.map(({ type, title }) => {
        const on = offeredFormats(type, disabledFormats)
        return (
          <Stack key={type} component="fieldset" spacing={0} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            <Typography component="legend" variant="subtitle2" sx={{ p: 0, mb: 0.5 }}>
              {title}
            </Typography>
            <Stack direction="row" flexWrap="wrap" columnGap={2.5} useFlexGap>
              {FORMAT_CODES[type].map((code) => {
                const isOn = on.includes(code)
                const last = isOn && on.length === 1
                return (
                  <CompactSwitch
                    key={code}
                    label={LABELS[code] ?? code}
                    checked={isOn}
                    disabled={disabled || last}
                    describedBy={last ? `share-formats-${type}-last` : undefined}
                    onChange={(next) => toggle(type, code, next)}
                  />
                )
              })}
            </Stack>
            {on.length === 1 && (
              <Typography id={`share-formats-${type}-last`} variant="caption" color="text.secondary">
                {title} need at least one format. Switch another on before turning this one off.
              </Typography>
            )}
          </Stack>
        )
      })}
      {error !== undefined && error !== null && (
        <Typography variant="caption" color="error" role="alert">
          {errorDetail(error, 'Could not save the share formats.')}
        </Typography>
      )}
    </Stack>
  )
}
