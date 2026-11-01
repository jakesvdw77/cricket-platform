import { Box, Typography } from '@mui/material'
import { TileChoiceGroup } from '../TileChoiceGroup'
import { MATCH_CONTENTS, MATCH_CONTENT_DESCRIPTIONS, MATCH_CONTENT_LABELS } from '../../utils/share/matchShareFormats'
import type { MatchContent } from '../../utils/share/matchShareFormats'

// docs/specs/131 Decision 7: a match with a published result lists Match Result first; it hands over to the result sharing.
export type MatchStepContent = MatchContent | 'RESULT'

export interface MatchContentStepProps {
  value: MatchStepContent | null
  onChange: (content: MatchStepContent) => void
  resultAvailable?: boolean
  // The reason a content cannot be chosen yet; absent means it can.
  gaps: Partial<Record<MatchContent, string>>
  loading: boolean
}

// docs/specs/131 (Step 1, What to share): the contents as ONE choice (radio tiles), (Side and Layout are chosen in the preview step). A content
// that cannot be shared yet stays listed and disabled with its reason as text.
export function MatchContentStep({ value, onChange, resultAvailable = false, gaps, loading }: MatchContentStepProps) {
  return (
    <Box>
      <Typography component="h3" sx={{ fontWeight: 700, mb: 1 }}>
        Content
      </Typography>
      <TileChoiceGroup<MatchStepContent>
        label="What to share"
        value={value === 'RESULT' ? (resultAvailable ? value : null) : value && !gaps[value] ? value : null}
        onChange={onChange}
        columns={{ xs: 'minmax(0, 1fr)' }}
        tileSx={{ minHeight: 64, py: 1, alignItems: 'center', justifyContent: 'flex-start', textAlign: 'left' }}
        options={[...(resultAvailable ? (['RESULT'] as const) : []), ...MATCH_CONTENTS].map((content) => {
          const gap = content === 'RESULT' || loading ? undefined : gaps[content]
          return {
            value: content,
            disabled: Boolean(gap),
            content: (
              <Box sx={{ minWidth: 0, width: '100%', textAlign: 'left', opacity: gap ? 0.85 : 1 }}>
                <Typography sx={{ fontWeight: 600, textAlign: 'left', color: gap ? 'text.disabled' : 'text.primary' }}>{content === 'RESULT' ? 'Match Result' : MATCH_CONTENT_LABELS[content]}</Typography>
                <Typography variant="caption" sx={{ display: 'block', color: gap ? 'warning.dark' : 'text.secondary' }}>
                  {gap ?? (content === 'RESULT' ? 'Scorecard, result card and summary' : MATCH_CONTENT_DESCRIPTIONS[content])}
                </Typography>
              </Box>
            ),
          }
        })}
      />
    </Box>
  )
}
