import type { ReactNode } from 'react'
import { Box, ButtonBase, Chip, Typography } from '@mui/material'
import { badgeSx } from '../../../../components/RecordCard'
import { GuessChip } from '../../../../components/GuessChip'
import { PlayerName } from '../../../../components/PlayerName'
import type { PersonName } from '../../../../utils/playerDisplayName'
import type { GuessInfo } from '../import/guessSummary'
import { UseClosestButton } from '../import/UseClosestButton'

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
  // docs/specs/104: an imported name that needs checking (a guess, or a name nobody matched): the Guess chip (or a tappable
  // Guest chip) replaces the plain Guest chip and the caption says what the file said.
  guess?: GuessInfo
  // False when the page shows the closest player itself (the Teams list, in its status column): no button and no Closest caption here.
  useClosestInCell?: boolean
  // False where a separate Type column already says Guest (the Teams list): no Guest chip, and no tappable Guest chip for an
  // unresolved import name either (`trailing` carries its control instead). The Guess chip is unaffected. Default true.
  showGuestChip?: boolean
  // Shown on the name's line after the chips, for example a compact Link button.
  trailing?: ReactNode
}

// docs/specs/101-match-results-our-side-scorecard.md (Our batting item 6): the player in a scorecard row. The name is a
// button that opens the row's popup menu (the route to reorder, swap, link and remove on a phone and for the keyboard);
// a Guest chip marks a name-only player; a small caption says "planned 3" or "replaced A. Smith".
export function ScorecardPlayerCell({ person, view, guest, caption, onOpen, duplicate = false, disabled = false, guess, useClosestInCell = true, showGuestChip = true, trailing }: ScorecardPlayerCellProps) {
  const guessCaption = guess ? (guess.level === 'UNRESOLVED' ? (guess.closest && useClosestInCell && !guess.onUseClosest ? `Closest: ${guess.closest.displayName}` : null) : `File said '${guess.importedName}'`) : null
  const captionText = [caption, guessCaption].filter(Boolean).join(' · ') || null
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
        {duplicate && <Chip size="small" color="error" variant="outlined" label="Duplicate" sx={{ height: { xs: 20, sm: 18 }, fontSize: '0.75rem', flex: 'none' }} />}
        {guess && (showGuestChip || guess.level !== 'UNRESOLVED') ? (
          <GuessChip
            importedName={guess.importedName}
            level={guess.level}
            matchedName={guess.matchedName}
            reason={guess.reason}
            onConfirm={guess.onConfirm}
            onChange={guess.onChange}
            guessKey={guess.key}
            disabled={disabled}
          />
        ) : (
          showGuestChip && guest && <Chip size="small" label="Guest" sx={{ ...badgeSx('neutral'), height: { xs: 20, sm: 18 }, fontSize: '0.75rem', flex: 'none' }} />
        )}
        {trailing}
      </Box>
      {useClosestInCell && guess?.onUseClosest && guess.closest && <UseClosestButton guess={guess} disabled={disabled} />}
      {captionText && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2, fontSize: { sm: '0.75rem' } }}>
          {captionText}
        </Typography>
      )}
    </Box>
  )
}
