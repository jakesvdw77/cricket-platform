import { Box, ButtonBase, Chip, Typography } from '@mui/material'
import { badgeSx } from '../../../../components/RecordCard'
import { PlayerName } from '../../../../components/PlayerName'
import type { PersonName } from '../../../../utils/playerDisplayName'

export interface ScorecardPlayerCellProps {
  person: PersonName
  // Everyone shown together, so a first-name collision is tagged.
  view: PersonName[]
  guest: boolean
  // "planned 3", "replaced A. Smith".
  caption?: string | null
  // Opens the name popup (Move up / Move down / position / Swap / Link / Remove).
  onOpen: (anchor: HTMLElement) => void
  // The same player is on the side twice: marks the row so it can be found and one removed.
  duplicate?: boolean
  disabled?: boolean
}

// docs/specs/101-match-results-our-side-scorecard.md (Our batting item 6): the player in a scorecard row. The name is a
// button that opens the row's popup menu (the route to reorder, swap, link and remove on a phone and for the keyboard);
// a Guest chip marks a name-only player; a small caption says "planned 3" or "replaced A. Smith".
export function ScorecardPlayerCell({ person, view, guest, caption, onOpen, duplicate = false, disabled = false }: ScorecardPlayerCellProps) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
        <ButtonBase
          disabled={disabled}
          aria-haspopup="menu"
          onClick={(event) => onOpen(event.currentTarget)}
          sx={{
            minHeight: { xs: 44, sm: 28 },
            maxWidth: '100%',
            justifyContent: 'flex-start',
            textAlign: 'left',
            fontSize: { xs: '0.875rem', sm: '0.75rem' },
            fontWeight: 600,
            color: 'text.primary',
            borderRadius: 0.5,
            '& > span': { borderBottom: '1px dotted', borderColor: 'primary.main', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            '&.Mui-focusVisible': { outline: 2, outlineStyle: 'solid', outlineColor: 'primary.main', outlineOffset: 1 },
          }}
        >
          <span>
            <PlayerName person={person} view={view} />
          </span>
        </ButtonBase>
        {duplicate && <Chip size="small" color="error" variant="outlined" label="Duplicate" sx={{ height: { xs: 20, sm: 18 }, fontSize: '0.7rem', flex: 'none' }} />}
        {guest && <Chip size="small" label="Guest" sx={{ ...badgeSx('neutral'), height: { xs: 20, sm: 18 }, fontSize: '0.7rem', flex: 'none' }} />}
      </Box>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2, fontSize: { sm: '0.6875rem' } }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}
