import { Link as RouterLink } from 'react-router-dom'
import { Box, Chip, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { badgeSx } from '../../../components/RecordCard'
import type { RecordCardBadgeTone } from '../../../components/RecordCard'
import type { TeamFormItem, TeamFormResult } from '../../../api/teamStatsApi'
import { resultViewTo } from '../results/resultListHelpers'
import { FORM_LETTER, FORM_WORD, matchLineText } from '../leaderboards/teamStatsFormat'
import { formatInstantDate } from '../../../utils/formatInstantDate'

// W positive, L the error tint, T and D plain outlined, NR muted. The letter is always the text, so colour is never the only cue.
const FORM_TONE: Record<TeamFormResult, RecordCardBadgeTone> = {
  WON: 'positive',
  LOST: 'closed',
  TIED: 'neutral',
  DRAWN: 'neutral',
  NO_RESULT: 'muted',
}

// A stronger fill than the shared badge: a 22% tint of the palette colour, its dark text, a matching border, bold letters.
const strongSx = (colour: 'success' | 'error') => (theme: Theme) => ({
  bgcolor: alpha(theme.palette[colour].main, 0.22),
  color: `${colour}.dark`,
  border: 1,
  borderColor: alpha(theme.palette[colour].main, 0.5),
  fontWeight: 700,
  '&:hover': { bgcolor: alpha(theme.palette[colour].main, 0.3) },
})

export interface TeamFormStripProps {
  items: TeamFormItem[]
  // the team page URL with its current filters: the result page's Back returns here
  backTo: string
}

// docs/specs/116-team-stats.md ("Form strip"): the last five counted results, newest first, as W / L / T / D / NR chips. Each
// chip opens that result (router state carries the way back), a derby is marked "internal" and a forfeit "forfeit". Only draws
// what the server sent; page part (a second page needing it would lift it into a shared component).
export function TeamFormStrip({ items, backTo }: TeamFormStripProps) {
  if (items.length === 0) return null
  return (
    <Box data-testid="team-form-strip" sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1 }}>
      <Stack spacing={0.75}>
        <Typography variant="caption" component="p" sx={{ m: 0, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Form, last {items.length === 1 ? 'result' : `${items.length} results`}, newest first
        </Typography>
        <Stack component="ul" direction="row" flexWrap="wrap" useFlexGap spacing={0.75} aria-label="Last results, newest first" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {items.map((item) => {
            const tone = FORM_TONE[item.result]
            const markers = [item.derby ? 'internal' : '', item.forfeit ? 'forfeit' : ''].filter(Boolean)
            const spoken = `${FORM_WORD[item.result]}${item.forfeit ? ' by forfeit' : ''} ${item.derby ? 'in an internal match' : 'against'} ${item.derby ? '' : item.opponentName || 'an unnamed opponent'}`.replace(/\s+/g, ' ').trim()
            const date = formatInstantDate(item.matchDate, true)
            return (
              <li key={item.resultId || item.matchId}>
                <Chip
                  component={RouterLink}
                  to={resultViewTo(item.matchId)}
                  state={{ backTo, backLabel: 'Team' }}
                  clickable
                  aria-label={`${spoken}${date ? `, ${date}` : ''}, open result`}
                  title={matchLineText(item)}
                  data-tone={tone}
                  variant={tone === 'neutral' ? 'outlined' : 'filled'}
                  label={
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                      <span>{FORM_LETTER[item.result]}</span>
                      {markers.map((marker) => (
                        <Box key={marker} component="span" sx={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.85 }}>
                          {marker}
                        </Box>
                      ))}
                    </Box>
                  }
                  sx={[{ height: 32, minWidth: 40, fontSize: '0.875rem', fontWeight: 700 }, badgeSx(tone), ...(tone === 'positive' ? [strongSx('success')] : tone === 'closed' ? [strongSx('error')] : [])]}
                />
              </li>
            )
          })}
        </Stack>
      </Stack>
    </Box>
  )
}
