import { Chip, Stack, Typography } from '@mui/material'
import { badgeSx } from '../RecordCard'
import type { RecordCardBadgeTone } from '../RecordCard'

export interface FormStripItem {
  // A stable key (the match id)
  key: string
  // The text drawn in the chip, already formatted by the caller ("56*", "2/21")
  label: string
  // positive = a good score or spell, muted = a duck, neutral = anything else
  tone?: Extract<RecordCardBadgeTone, 'positive' | 'muted' | 'neutral'>
  // Spoken form when the label alone is unclear ("56 not out")
  ariaLabel?: string
}

export interface FormStripProps {
  // The strip's heading, e.g. "Batting, last 5 innings"
  title: string
  items: FormStripItem[]
  // Kept for existing callers; both sizes now draw the same 36 px chip (docs/specs/103 readability pass)
  size?: 'compact' | 'comfortable'
  // The heading is already shown by the card around the strip; it stays as the list's accessible name
  hideTitle?: boolean
}

// docs/specs/103-player-stats.md: the recent-form strip (last 5 batting innings, last 5 bowling spells, newest first)
// drawn as small chips with the shared badge tones. Used by the Player page Stats card and the breakdown page. Renders
// nothing for an empty list, so a player with no innings shows no strip. Only formats what it is given.
export function FormStrip({ title, items, hideTitle = false }: FormStripProps) {
  if (items.length === 0) return null
  const height = 36
  return (
    <Stack spacing={0.75} data-testid="form-strip">
      {!hideTitle && (
        <Typography
          variant="caption"
          component="p"
          sx={{ m: 0, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.secondary' }}
        >
          {title}
        </Typography>
      )}
      <Stack component="ul" direction="row" flexWrap="wrap" useFlexGap spacing={0.75} aria-label={title} sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {items.map((item) => (
          <li key={item.key}>
            <Chip
              label={item.label}
              aria-label={item.ariaLabel}
              data-tone={item.tone ?? 'neutral'}
              variant={item.tone && item.tone !== 'neutral' ? 'filled' : 'outlined'}
              sx={[
                { height, minWidth: 40, fontSize: '0.9375rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
                ...(item.tone && item.tone !== 'neutral' ? [badgeSx(item.tone)] : []),
              ]}
            />
          </li>
        ))}
      </Stack>
    </Stack>
  )
}
