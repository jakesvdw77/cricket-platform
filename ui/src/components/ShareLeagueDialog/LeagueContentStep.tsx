import { Box, Checkbox, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { LEAGUE_CONTENTS, LEAGUE_CONTENT_LABELS } from '../../utils/share/leagueShareFormats'
import type { LeagueContent } from '../../utils/share/leagueShareFormats'

const DESCRIPTIONS: Record<LeagueContent, string> = {
  DETAILS: 'Name, format, age group, contacts',
  CONDITIONS: 'Overs, powerplay, points, rules',
  TEAMS: 'The teams entered this season',
  SCHEDULE: 'The fixtures of this season',
  RESULTS: 'Published results of this season',
  KEY_DATES: 'Season start and end, first, next and last match',
}

export interface LeagueContentStepProps {
  ticked: LeagueContent[]
  onToggle: (content: LeagueContent) => void
  // The reason a content cannot be shared yet (greyed, not ticked); absent means it can.
  gaps: Partial<Record<LeagueContent, string>>
  loading: boolean
}

// docs/specs/122-league-sharing.md (Step 1, What to share): a checkbox row per content. A content with nothing to share stays
// listed but disabled with its reason.
export function LeagueContentStep({ ticked, onToggle, gaps, loading }: LeagueContentStepProps) {
  return (
    <Box role="group" aria-label="What to share" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {LEAGUE_CONTENTS.map((content) => {
        const gap = loading ? undefined : gaps[content]
        const checked = ticked.includes(content) && !gap
        const id = `share-league-content-${content}`
        return (
          <Box
            key={content}
            component="label"
            htmlFor={id}
            sx={(theme) => ({
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              minHeight: 44,
              px: 1,
              py: 0.75,
              border: 1,
              borderRadius: 1,
              borderColor: checked ? 'primary.main' : 'divider',
              bgcolor: checked ? alpha(theme.palette.primary.main, 0.07) : gap ? alpha(theme.palette.text.primary, 0.04) : 'background.paper',
              cursor: gap ? 'default' : 'pointer',
              opacity: gap ? 0.85 : 1,
            })}
          >
            <Checkbox
              id={id}
              size="small"
              checked={checked}
              disabled={Boolean(gap) || loading}
              onChange={() => onToggle(content)}
              inputProps={gap ? { 'aria-describedby': `${id}-reason` } : undefined}
              sx={{ p: 0.5 }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, color: gap ? 'text.disabled' : 'text.primary' }}>{LEAGUE_CONTENT_LABELS[content]}</Typography>
              <Typography id={`${id}-reason`} variant="caption" sx={{ display: 'block', color: gap ? 'warning.dark' : 'text.secondary' }}>
                {gap ?? DESCRIPTIONS[content]}
              </Typography>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
