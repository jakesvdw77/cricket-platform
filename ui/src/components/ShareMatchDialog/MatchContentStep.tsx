import { Box, Typography } from '@mui/material'
import { ToggleButton } from '@mui/material'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { TileChoiceGroup } from '../TileChoiceGroup'
import { MATCH_CONTENTS, MATCH_CONTENT_DESCRIPTIONS, MATCH_CONTENT_LABELS, MATCH_LAYOUTS, MATCH_LAYOUT_LABELS as LAYOUT_LABELS, MATCH_SIDE_CHOICES, MATCH_SIDE_LABELS as SIDE_LABELS, usesLineup } from '../../utils/share/matchShareFormats'
import type { MatchContent, MatchLayout, MatchSideChoice } from '../../utils/share/matchShareFormats'

export interface MatchContentStepProps {
  value: MatchContent | null
  onChange: (content: MatchContent) => void
  // The reason a content cannot be chosen yet; absent means it can.
  gaps: Partial<Record<MatchContent, string>>
  side: MatchSideChoice
  onSideChange: (side: MatchSideChoice) => void
  sideGaps: Record<MatchSideChoice, string | null>
  layout: MatchLayout
  onLayoutChange: (layout: MatchLayout) => void
  loading: boolean
}

// docs/specs/131 (Step 1, What to share): the contents as ONE choice (radio tiles), then Side and, for Both, Layout. A content
// that cannot be shared yet stays listed and disabled with its reason as text.
export function MatchContentStep({ value, onChange, gaps, side, onSideChange, sideGaps, layout, onLayoutChange, loading }: MatchContentStepProps) {
  const lineup = value !== null && usesLineup(value)
  const sideReason = MATCH_SIDE_CHOICES.map((item) => sideGaps[item]).find(Boolean) ?? null
  return (
    <Box>
      <Typography component="h3" sx={{ fontWeight: 700, mb: 1 }}>
        Content
      </Typography>
      <TileChoiceGroup<MatchContent>
        label="What to share"
        value={value && !gaps[value] ? value : null}
        onChange={onChange}
        columns={{ xs: 'minmax(0, 1fr)' }}
        tileSx={{ minHeight: 56, py: 1, alignItems: 'flex-start', justifyContent: 'center', textAlign: 'left' }}
        options={MATCH_CONTENTS.map((content) => {
          const gap = loading ? undefined : gaps[content]
          return {
            value: content,
            disabled: Boolean(gap),
            content: (
              <Box sx={{ minWidth: 0, opacity: gap ? 0.85 : 1 }}>
                <Typography sx={{ fontWeight: 600, color: gap ? 'text.disabled' : 'text.primary' }}>{MATCH_CONTENT_LABELS[content]}</Typography>
                <Typography variant="caption" sx={{ display: 'block', color: gap ? 'warning.dark' : 'text.secondary' }}>
                  {gap ?? MATCH_CONTENT_DESCRIPTIONS[content]}
                </Typography>
              </Box>
            ),
          }
        })}
      />
      {lineup && (
        <Box sx={{ mt: 2 }}>
          <Typography component="h3" sx={{ fontWeight: 700, mb: 1 }}>
            Side
          </Typography>
          <CompactToggleGroup value={side} ariaLabel="Side" fullWidthOnPhone onChange={onSideChange}>
            {MATCH_SIDE_CHOICES.map((item) => (
              <ToggleButton key={item} value={item} disabled={Boolean(sideGaps[item])} aria-describedby={sideGaps[item] ? 'match-step-side-reason' : undefined}>
                {SIDE_LABELS[item]}
              </ToggleButton>
            ))}
          </CompactToggleGroup>
          {sideReason && (
            <Typography id="match-step-side-reason" variant="caption" sx={{ display: 'block', mt: 0.5, color: 'warning.dark' }}>
              {sideReason}
            </Typography>
          )}
          {side === 'BOTH' && !sideGaps.BOTH && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ fontWeight: 700, mb: 0.5 }}>
                Layout
              </Typography>
              <CompactToggleGroup value={layout} ariaLabel="Layout" fullWidthOnPhone onChange={onLayoutChange}>
                {MATCH_LAYOUTS.map((item) => (
                  <ToggleButton key={item} value={item}>
                    {LAYOUT_LABELS[item]}
                  </ToggleButton>
                ))}
              </CompactToggleGroup>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
