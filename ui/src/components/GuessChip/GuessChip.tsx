import { useState } from 'react'
import { Box, Chip, Popover, Typography } from '@mui/material'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import { badgeSx } from '../RecordCard'
import { Button } from '../Button'

// How the name was linked. NORMALISED is a rule-based guess; AI_SUGGESTED is reserved for a later tier and drawn like a
// guess; UNRESOLVED is a name nobody matched, so a guest that still needs a player chosen.
export type GuessChipLevel = 'NORMALISED' | 'AI_SUGGESTED' | 'UNRESOLVED'

export interface GuessChipProps {
  // The name as the file wrote it ("Hugo K").
  importedName: string
  level: GuessChipLevel
  // Who the guess became ("Hugo Kemp"); not used for an unresolved name.
  matchedName?: string | null
  // How it was matched, as a phrase that follows "Matched to <name>" ("by the start of the surname"); omitted when unknown.
  reason?: string | null
  // Confirm keeps the player and clears the flag (a guess only).
  onConfirm?: () => void
  // Change opens the player picker. For an unresolved name this is the whole tap.
  onChange: () => void
  disabled?: boolean
  // Lets a page find this chip (Next one to check).
  guessKey?: string
}

const CHIP_HEIGHT = { xs: 32, sm: 24 }

// docs/specs/104-match-results-import-adaptors.md (the Guess chip): an icon-plus-word chip on any of our rows whose player
// an import linked by a rule that is only a guess, so the manager checks it before publishing. Tapping it opens a small
// popover saying what the file said and who it was matched to, with Confirm and Change. An unresolved name shows a Guest
// chip instead, and tapping that goes straight to the picker. The tap area is 44 px on a phone whatever the chip's size.
export function GuessChip({ importedName, level, matchedName, reason, onConfirm, onChange, disabled = false, guessKey }: GuessChipProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const close = () => setAnchor(null)

  const hitArea = {
    position: 'relative',
    flex: 'none',
    '&::after': { content: '""', position: 'absolute', top: -6, bottom: -6, left: -4, right: -4 },
  } as const

  if (level === 'UNRESOLVED') {
    return (
      <Chip
        size="small"
        label="Guest"
        clickable
        disabled={disabled}
        onClick={onChange}
        data-guess-key={guessKey}
        aria-label={`Choose the player for ${importedName}`}
        sx={{ ...badgeSx('neutral'), height: CHIP_HEIGHT, fontSize: '0.75rem', ...hitArea }}
      />
    )
  }

  const matched = matchedName ? `, matched to ${matchedName}` : ''
  return (
    <>
      <Chip
        size="small"
        label="Guess"
        icon={<HelpOutlineIcon sx={{ fontSize: 16 }} />}
        clickable
        disabled={disabled}
        onClick={(event) => setAnchor(event.currentTarget)}
        data-guess-key={guessKey}
        aria-haspopup="dialog"
        aria-label={`Guess: file said ${importedName}${matched}. Check this player`}
        sx={{ ...badgeSx('warning'), height: CHIP_HEIGHT, fontSize: '0.75rem', ...hitArea }}
      />
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { mt: 0.5, p: 1.75, maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 1.25 } } }}
      >
        <Typography variant="subtitle2" component="p" fontWeight={700}>
          Check this player
        </Typography>
        <Typography variant="body2">
          File said <b>&apos;{importedName}&apos;</b>.{' '}
          {matchedName ? (
            <>
              {level === 'AI_SUGGESTED' ? 'Suggested match: ' : 'Matched to '}
              <b>{matchedName}</b>
              {reason ? ` ${reason}` : ''}.
            </>
          ) : null}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onConfirm && (
            <Button
              size="compact"
              fullWidth
              
              onClick={() => {
                close()
                onConfirm()
              }}
            >
              Confirm
            </Button>
          )}
          <Button
            size="compact"
            variant="secondary"
            fullWidth
            
            onClick={() => {
              close()
              onChange()
            }}
          >
            Change
          </Button>
        </Box>
      </Popover>
    </>
  )
}
