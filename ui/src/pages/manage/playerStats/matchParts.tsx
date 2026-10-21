import type { ReactNode } from 'react'
import { Box, Chip } from '@mui/material'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { badgeSx } from '../../../components/RecordCard'
import type { PlayerAwardCounts, PlayerMatchResultCode } from '../../../api/playerStatsApi'
import { RESULT_LABEL, RESULT_TONE } from './matchesFormat'

// docs/specs/115-player-match-list.md: small presentational pieces shared by the table row and the phone card.

// Text and a dot, never colour alone.
export function ResultBadge({ result }: { result: PlayerMatchResultCode }) {
  return (
    <Chip
      size="small"
      data-testid="match-result"
      variant={RESULT_TONE[result] === 'neutral' ? 'outlined' : 'filled'}
      sx={{ ...badgeSx(RESULT_TONE[result]), fontSize: '0.8125rem' }}
      label={
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <Box aria-hidden component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'currentColor', flex: 'none' }} />
          {RESULT_LABEL[result]}
        </Box>
      }
    />
  )
}

// Player of the match (filled trophy) and the team's player of the match (outlined trophy). In the table only the icon shows, with an
// accessible name; on a phone card the text is visible beside it.
export function AwardMarkers({ awards, showText = false }: { awards: PlayerAwardCounts; showText?: boolean }) {
  const items = [
    awards.playerOfTheMatch > 0 && { key: 'potm', label: 'Player of the match', text: 'POTM', Icon: EmojiEventsIcon },
    awards.teamPlayerOfTheMatch > 0 && { key: 'team', label: 'Team player of the match', text: 'Team POTM', Icon: EmojiEventsOutlinedIcon },
  ].filter((item): item is { key: string; label: string; text: string; Icon: typeof EmojiEventsIcon } => Boolean(item))
  if (items.length === 0) return null
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      {items.map(({ key, label, text, Icon }) => (
        <Box
          key={key}
          component="span"
          data-testid={`award-${key}`}
          {...(showText ? {} : { role: 'img', 'aria-label': label, title: label })}
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'warning.dark', fontSize: '0.75rem', fontWeight: 700 }}
        >
          <Icon aria-hidden fontSize="small" />
          {showText && text}
        </Box>
      ))}
    </Box>
  )
}

// A labelled line on the phone card: Batting, Bowling or Fielding.
export function CardLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 1, fontSize: '0.875rem', lineHeight: 1.4 }}>
      <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.secondary', pt: '2px' }}>
        {label}
      </Box>
      <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{children}</Box>
    </Box>
  )
}
