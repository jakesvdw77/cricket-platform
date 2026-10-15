import { useState } from 'react'
import type { ClipboardEvent } from 'react'
import { Autocomplete, Box, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { MAX_PASTED_NAMES, parseNameList } from '../../../../utils/parseNameList'
import type { PickOption } from './PlayerPickCombo'

const NEW_KEY = '\u0000new'

export interface AddPlayerRowProps {
  // The placeholder and accessible name.
  label?: string
  // Players who can be picked (the squad for our side, the opposition list); a typed name that matches none is added as a
  // new name.
  options: PickOption[]
  // The last option while typing: "Add as a guest" (our side) / "Add a new name" (the opposition).
  addLabel: string
  onPick: (key: string) => void
  onAddName: (name: string) => void
  // A pasted list: the names to add in order (blank lines, list markers, duplicates and the 15-name cap already dealt with).
  onAddNames: (names: string[]) => void
  // The names already on the side, so a pasted list skips them.
  existingNames: string[]
  disabled?: boolean
}

interface Choice extends PickOption {
  newName?: string
}

// docs/specs/101-match-results-our-side-scorecard.md (Batting and Bowling, inline typing): the quiet trailing row of a grid.
// Type a name and press Enter to add the player; pick someone from the list; or paste a list (one name per line). Adding
// creates the team-sheet entry, so nobody has to go back to Teams. Focus stays here, so the next name can follow at once.
export function AddPlayerRow({ label = 'Type a name to add a player', options, addLabel, onPick, onAddName, onAddNames, existingNames, disabled = false }: AddPlayerRowProps) {
  const [text, setText] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const add = (name: string) => {
    const trimmed = name.trim()
    if (trimmed === '') return
    setNotice(null)
    onAddName(trimmed)
    setText('')
  }

  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    const pasted = event.clipboardData.getData('text')
    if (!/\r?\n/.test(pasted.trim())) return
    event.preventDefault()
    const parsed = parseNameList(pasted, existingNames)
    if (parsed.names.length > 0) onAddNames(parsed.names)
    setNotice(
      [
        parsed.truncated ? `Only the first ${MAX_PASTED_NAMES} names were added.` : null,
        parsed.duplicates.length > 0 ? `${parsed.duplicates.length} already on the list ${parsed.duplicates.length === 1 ? 'was' : 'were'} skipped.` : null,
      ]
        .filter(Boolean)
        .join(' ') || null,
    )
    setText('')
  }

  return (
    <Box>
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2, px: 1, py: 0.5, bgcolor: 'background.paper' }}
      >
        <AddIcon fontSize="small" sx={{ color: 'text.secondary', flex: 'none' }} />
        <Autocomplete<Choice, false, false, true>
          freeSolo
          openOnFocus
          fullWidth
          size="small"
          disabled={disabled}
          options={options}
          value={null}
          inputValue={text}
          onInputChange={(_event, next, reason) => {
            if (reason !== 'reset') setText(next)
          }}
          getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
          filterOptions={(all, state) => {
            const typed = state.inputValue.trim().toLowerCase()
            if (typed === '') return all
            const matching = all.filter((option) => option.label.toLowerCase().includes(typed))
            const exact = all.some((option) => option.label.toLowerCase() === typed)
            return exact ? matching : [...matching, { key: NEW_KEY, label: `${addLabel}: ${state.inputValue.trim()}`, newName: state.inputValue.trim() }]
          }}
          onChange={(_event, choice) => {
            if (typeof choice === 'string') add(choice)
            else if (choice?.newName) add(choice.newName)
            else if (choice) {
              setNotice(null)
              onPick(choice.key)
              setText('')
            }
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
          renderInput={(params) => (
            <TextField
              {...params}
              variant="standard"
              placeholder={label}
              onPaste={onPaste}
              inputProps={{ ...params.inputProps, 'aria-label': label, autoComplete: 'off' }}
              InputProps={{ ...params.InputProps, disableUnderline: true, sx: { minHeight: { xs: 44, sm: 32 }, fontSize: { xs: '0.875rem', sm: '0.8125rem' } } }}
            />
          )}
        />
      </Box>
      {notice && (
        <Typography variant="caption" color="text.secondary" role="status" sx={{ display: 'block', mt: 0.5 }}>
          {notice}
        </Typography>
      )}
    </Box>
  )
}
