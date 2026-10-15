import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Autocomplete, Box, TextField } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { GuessChip } from '../../../../components/GuessChip'
import type { GuessInfo } from '../import/guessSummary'

export interface PickOption {
  key: string
  label: string
  // A second line in the list ("Bowler", "12th man").
  hint?: string
}

const NEW_KEY = '\u0000new'

export interface PlayerPickComboProps {
  ariaLabel: string
  // The chosen option's key, or null.
  value: string | null
  options: PickOption[]
  onPick: (key: string | null) => void
  // Typing a name that is not in the list offers "<addLabel> ..." as the LAST option; choosing it calls this with the text.
  // Omitted, only the listed players can be chosen.
  onAddNew?: (name: string) => void
  addLabel?: string
  placeholder?: string
  // The grid column (ArrowUp / ArrowDown move within it).
  column?: string
  disabled?: boolean
  // Phone cards: full width and 44 px high.
  fullWidth?: boolean
  // A soft amber warning (nothing chosen yet where the dismissal expects someone); never blocks.
  warn?: boolean
  // docs/specs/104: the chosen player is an imported guess: an amber field with the Guess chip inside it (44 px target).
  guess?: GuessInfo
}

interface Choice extends PickOption {
  newName?: string
}

// docs/specs/101-match-results-our-side-scorecard.md (Batting, the dismissal's bowler and fielder): a small type-ahead select
// over the OTHER side's players. A name that is not on the list can be added from the control itself ("Add a new name" as
// the last option), so nobody has to leave the step. A real input in the grid (`data-grid-cell`), so Enter / Arrow keys
// navigate like every other cell; while the list is open the arrows pick from it instead.
export function PlayerPickCombo({ ariaLabel, value, options, onPick, onAddNew, addLabel = 'Add a new name', placeholder, column = 'dismissal', disabled = false, fullWidth = false, warn = false, guess }: PlayerPickComboProps) {
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const selected: Choice | null = options.find((option) => option.key === value) ?? null
  const height = fullWidth ? 44 : 30
  const flagged = warn || Boolean(guess)

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // The list is open: the arrows pick from it, they do not move to another row of the grid.
    if (openRef.current && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) event.stopPropagation()
  }

  return (
    <Box onKeyDown={onKeyDown} sx={{ width: '100%', minWidth: fullWidth ? 0 : 140 }}>
      <Autocomplete<Choice>
        size="small"
        disabled={disabled}
        slotProps={{ popper: { sx: { minWidth: 220 } } }}
        options={options}
        value={selected}
        open={open}
        onOpen={() => {
          openRef.current = true
          setOpen(true)
        }}
        onClose={() => {
          openRef.current = false
          setOpen(false)
        }}
        isOptionEqualToValue={(a, b) => a.key === b.key}
        getOptionLabel={(option) => option.label}
        filterOptions={(all, state) => {
          const typed = state.inputValue.trim().toLowerCase()
          const matching = typed === '' || (selected && selected.label.toLowerCase() === typed) ? all : all.filter((option) => option.label.toLowerCase().includes(typed))
          if (!onAddNew) return matching
          const exact = all.some((option) => option.label.toLowerCase() === typed)
          if (state.inputValue.trim() === '' || exact) return matching
          return [...matching, { key: NEW_KEY, label: `${addLabel}: ${state.inputValue.trim()}`, newName: state.inputValue.trim() }]
        }}
        onChange={(_event, choice) => {
          if (!choice) onPick(null)
          else if (choice.key === NEW_KEY && choice.newName) onAddNew?.(choice.newName)
          else onPick(choice.key)
        }}
        renderOption={(props, option) => (
          <li {...props} key={option.key} style={{ minHeight: 44 }}>
            <Box sx={{ minWidth: 0 }}>
              <Box component="span" sx={{ fontSize: 13, fontWeight: option.key === NEW_KEY ? 700 : 400, color: option.key === NEW_KEY ? 'primary.main' : 'text.primary' }}>
                {option.label}
              </Box>
              {option.hint && (
                <Box component="span" sx={{ display: 'block', fontSize: 12, color: 'text.secondary' }}>
                  {option.hint}
                </Box>
              )}
            </Box>
          </li>
        )}
        noOptionsText={onAddNew ? 'Type a name to add it' : 'No one to choose'}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={placeholder ?? 'Choose'}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {guess && (
                    <GuessChip
                      importedName={guess.importedName}
                      level={guess.level}
                      matchedName={guess.matchedName}
                      reason={guess.reason}
                      onConfirm={guess.onConfirm}
                      onChange={guess.onChange}
                      guessKey={`${guess.key}:${column}`}
                      disabled={disabled}
                    />
                  )}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
            inputProps={{ ...params.inputProps, 'aria-label': ariaLabel, title: selected?.label, 'data-grid-cell': '', 'data-grid-col': column, autoComplete: 'off' }}
            sx={{
              '& .MuiOutlinedInput-root': { height, fontSize: fullWidth ? undefined : 12, fontWeight: 600, borderRadius: 1.5, py: 0, bgcolor: flagged ? (theme: Theme) => alpha(theme.palette.warning.main, 0.12) : 'background.paper' },
              ...(flagged ? { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'warning.main' } } : {}),
              '& .MuiOutlinedInput-root .MuiAutocomplete-input': { py: 0, px: 0.5 },
            }}
          />
        )}
      />
    </Box>
  )
}
