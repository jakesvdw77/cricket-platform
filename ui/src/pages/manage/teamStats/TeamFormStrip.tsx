import { Link as RouterLink } from 'react-router-dom'
import { Box, Stack, Typography } from '@mui/material'
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

export interface TeamFormStripProps {
  items: TeamFormItem[]
  // the team page URL with its current filters: the result page's Back returns here
  backTo: string
}

// docs/specs/116-team-stats.md ("Form strip"): the last five counted results, newest first, as W / L / T / D / NR round chips with the match date
// under each. Each
// chip opens that result (router state carries the way back), a derby is marked "internal" and a forfeit "forfeit". Only draws
// what the server sent; page part (a second page needing it would lift it into a shared component).
export function TeamFormStrip({ items, backTo }: TeamFormStripProps) {
  if (items.length === 0) return null
  return (
    <Box data-testid="team-form-strip" sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1 }}>
      <Stack spacing={0.75}>
        <Typography variant="caption" component="p" sx={{ m: 0, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Recent form
        </Typography>
        <Stack component="ul" direction="row" flexWrap="wrap" useFlexGap spacing={1.5} aria-label="Last results, newest first" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {items.map((item) => {
            const tone = FORM_TONE[item.result]
            const markers = [item.derby ? 'internal' : '', item.forfeit ? 'forfeit' : ''].filter(Boolean)
            const spoken = `${FORM_WORD[item.result]}${item.forfeit ? ' by forfeit' : ''} ${item.derby ? 'in an internal match' : 'against'} ${item.derby ? '' : item.opponentName || 'an unnamed opponent'}`.replace(/\s+/g, ' ').trim()
            const longDate = formatInstantDate(item.matchDate, true)
            // "6 Sep": the short date without its year, the year is in the accessible name and title
            const shortDate = formatInstantDate(item.matchDate).replace(/\s\d{4}$/, '')
            return (
              <Box component="li" key={item.resultId || item.matchId} sx={{ minWidth: 56 }}>
                <Box
                  component={RouterLink}
                  to={resultViewTo(item.matchId)}
                  state={{ backTo, backLabel: 'Team' }}
                  aria-label={`${spoken}${longDate ? `, ${longDate}` : ''}, open result`}
                  title={matchLineText(item)}
                  data-tone={tone}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.25,
                    color: 'text.secondary',
                    textDecoration: 'none',
                    '&:hover .form-circle': { filter: 'brightness(0.96)' },
                  }}
                >
                  <Box
                    component="span"
                    className="form-circle"
                    sx={[
                      {
                        // 44 px round: the look and the phone hit area in one
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        boxSizing: 'border-box',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9375rem',
                        fontWeight: 700,
                        // an internal (derby) match: a thicker primary-blue ring
                        ...(item.derby ? { border: '3px solid', borderColor: 'primary.main' } : {}),
                        ...(tone === 'neutral' ? { border: item.derby ? '3px solid' : '1px solid', borderColor: item.derby ? 'primary.main' : 'divider', color: 'text.primary' } : {}),
                      },
                      badgeSx(tone, { strong: true }),
                      // the ring wins over the tone's own border
                      ...(item.derby ? [{ border: '3px solid', borderColor: 'primary.main' }] : []),
                    ]}
                  >
                    {FORM_LETTER[item.result]}
                  </Box>
                  <Typography component="span" variant="caption" sx={{ fontSize: '0.75rem', lineHeight: 1.3, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    {shortDate}
                  </Typography>
                  {markers.map((marker) => (
                    <Typography key={marker} component="span" variant="caption" sx={{ fontSize: '0.6875rem', lineHeight: 1.2, fontWeight: 700, color: 'primary.main' }}>
                      {marker}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )
          })}
        </Stack>
      </Stack>
    </Box>
  )
}
