import { Box, ToggleButton, Typography } from '@mui/material'
import type { ResultSide } from '../../../../api/matchResultApi'
import { CompactToggleGroup } from '../../../../components/CompactToggleGroup'
import { NameModeToggle } from '../../../../components/NameModeToggle'
import type { OurSide } from '../steps/stepTypes'

export interface ScorecardStepHeaderProps {
  oursSides: OurSide[]
  scorecardSide: ResultSide
  onSideChange: (side: ResultSide) => void
  // The sides with entries that are missing or unsaved: a small dot on their tab.
  incomplete?: Partial<Record<ResultSide, boolean>>
  // One line under the toggles ("From the announced team").
  note?: string
}

// docs/specs/101-match-results-our-side-scorecard.md (Wizard steps, Derby, Player name display toggle): the top of every
// scorecard step. The Full name | First name toggle always; in a derby (both sides ours) also the Home | Away switch, each
// tab labelled with its team and carrying a dot while that side is incomplete. A single ours side shows no switch.
export function ScorecardStepHeader({ oursSides, scorecardSide, onSideChange, incomplete = {}, note }: ScorecardStepHeaderProps) {
  const derby = oursSides.length > 1
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
        {derby ? (
          <CompactToggleGroup<ResultSide> value={scorecardSide} onChange={onSideChange} ariaLabel="Team" fullWidthOnPhone>
            {oursSides.map((ours) => (
              <ToggleButton key={ours.side} value={ours.side} aria-label={`${ours.side === 'HOME' ? 'Home' : 'Away'}: ${ours.teamName}`}>
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: { xs: 120, sm: 220 } }}>
                  {ours.side === 'HOME' ? 'Home' : 'Away'} · {ours.teamName}
                </Box>
                {incomplete[ours.side] && (
                  <>
                    <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main', flex: 'none' }} />
                    <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                      incomplete
                    </Box>
                  </>
                )}
              </ToggleButton>
            ))}
          </CompactToggleGroup>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
            {oursSides[0]?.teamName}
          </Typography>
        )}
        <NameModeToggle />
      </Box>
      {note && (
        <Typography variant="caption" color="text.secondary">
          {note}
        </Typography>
      )}
    </Box>
  )
}
