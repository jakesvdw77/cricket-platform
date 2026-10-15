import { IconButton, Tooltip } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import type { FeaturedOverride } from '../../api/matchResultApi'
import { effectiveFeatured, toggledOverride } from '../../utils/standout'

export interface StandoutToggleProps {
  // The rules' suggestion for this row and the manager's override (null = follow the suggestion).
  suggested: boolean
  override: FeaturedOverride | null
  // Writes the new override (HIDE on a suggested row, FEATURE on any other, null when the tap restores the suggestion).
  onChange: (override: FeaturedOverride | null) => void
  // The player's label as shown ("A. Smith"), for the accessible name "Featured, A. Smith".
  playerLabel: string
  // A published result: the star shows the frozen flag and cannot be tapped.
  readOnly?: boolean
}

const STAR_SIZE = 22

// docs/specs/101-match-results-our-side-scorecard.md (Standout icon toggle): the star on every batting, bowling and
// fielding row. Filled = featured (effective), outlined = not. A suggested star the manager has not touched is tinted
// ("suggested"); one the manager set is solid. 44 px tap target on a phone. The icon is under 32 px, so it is MUI's
// Star / StarBorder, not a brand icon.
export function StandoutToggle({ suggested, override, onChange, playerLabel, readOnly = false }: StandoutToggleProps) {
  const featured = effectiveFeatured(suggested, override)
  const untouchedSuggestion = featured && override === null
  const Icon = featured ? StarIcon : StarBorderIcon
  const color = featured
    ? (theme: Theme) => (untouchedSuggestion ? alpha(theme.palette.warning.main, 0.55) : theme.palette.warning.main)
    : 'text.disabled'
  const name = `Featured, ${playerLabel}`
  const hint = readOnly
    ? featured
      ? 'Featured'
      : 'Not featured'
    : untouchedSuggestion
      ? 'Suggested from the scorecard. Tap to remove.'
      : featured
        ? 'Featured. Tap to remove.'
        : suggested
          ? 'Removed. Tap to restore the suggestion.'
          : 'Tap to feature.'

  if (readOnly) {
    return (
      <Tooltip title={hint} describeChild>
        <span role="img" aria-label={`${name}: ${featured ? 'yes' : 'no'}`} style={{ display: 'inline-flex' }}>
          <Icon sx={{ fontSize: STAR_SIZE, color }} />
        </span>
      </Tooltip>
    )
  }

  return (
    <Tooltip title={hint} describeChild>
      <IconButton
        aria-label={name}
        aria-pressed={featured}
        onClick={() => onChange(toggledOverride(suggested, override))}
        sx={{ width: { xs: 44, sm: 32 }, height: { xs: 44, sm: 32 }, flex: 'none', p: 0 }}
      >
        <Icon sx={{ fontSize: STAR_SIZE, color }} />
      </IconButton>
    </Tooltip>
  )
}
