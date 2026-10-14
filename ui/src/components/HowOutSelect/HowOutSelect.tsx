import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Box, InputBase, Paper } from '@mui/material'
import type { DismissalType } from '../../api/matchResultApi'
import { bestDismissal, dismissalLabel, matchDismissals } from '../../utils/dismissal'

export interface HowOutSelectProps {
  // Null = undecided.
  value: DismissalType | null
  onChange: (value: DismissalType | null) => void
  // "How out, A. Smith".
  ariaLabel: string
  // The grid column (for ArrowUp / ArrowDown); defaults to "howOut".
  column?: string
  disabled?: boolean
  // Shown beside an automatic Not out / Did not bat ("Not out · auto" reads from the value; this adds the word).
  auto?: boolean
  // Phone cards: full width and 44 px high.
  fullWidth?: boolean
}

// docs/specs/101-match-results-our-side-scorecard.md (Our batting, keyboard-first): the How out field. A real text input
// that is a type-ahead: type `c` for Caught, `b` Bowled, `l` LBW, `r` Run out, `s` Stumped, `n` Not out, `d` Did not bat,
// `cb` Caught and bowled, `ro` Retired out, `rn` Retired not out; the matching dismissals list under the field and Enter
// (or leaving the field) accepts the highlighted one, so a scorer never touches the mouse. A click or tap opens the whole
// list. Arrow keys move the highlight while the list is open and otherwise move between rows (the grid's handling).
// Clearing the field and leaving it makes the row undecided again.
export function HowOutSelect({ value, onChange, ariaLabel, column = 'howOut', disabled = false, auto = false, fullWidth = false }: HowOutSelectProps) {
  const listId = useId()
  // The text being typed; null while the field shows the chosen dismissal.
  const [query, setQuery] = useState<string | null>(null)
  const [highlight, setHighlight] = useState(0)
  // Read by the blur that follows an Enter in the same tick, before React has re-rendered.
  const queryRef = useRef<string | null>(null)
  const highlightRef = useRef(0)

  const setQ = (next: string | null) => {
    queryRef.current = next
    setQuery(next)
  }
  const setH = (next: number) => {
    highlightRef.current = next
    setHighlight(next)
  }

  const open = query !== null
  const options = open ? matchDismissals(query) : []

  const accept = (type: DismissalType | null) => {
    setQ(null)
    setH(0)
    if (type !== value) onChange(type)
  }

  // What leaving the field or pressing Enter does with the text: the highlighted match, else nothing; an emptied field
  // clears the answer.
  const commit = () => {
    const typed = queryRef.current
    if (typed === null) return
    if (typed.trim() === '') {
      accept(null)
      return
    }
    const matches = matchDismissals(typed)
    accept(matches[Math.min(highlightRef.current, matches.length - 1)]?.type ?? bestDismissal(typed) ?? value)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      // The list is open: the arrows pick from it instead of moving to another row.
      event.preventDefault()
      event.stopPropagation()
      const count = options.length
      if (count > 0) setH((highlightRef.current + (event.key === 'ArrowDown' ? 1 : count - 1)) % count)
      return
    }
    if (event.key === 'Enter') {
      // Accept, then let the event reach the grid, which moves to the next cell.
      commit()
      return
    }
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      setQ(null)
      return
    }
    if (event.key === 'Tab') commit()
  }

  const shown = open ? query : dismissalLabel(value)

  return (
    <Box sx={{ position: 'relative', width: fullWidth ? '100%' : 148 }}>
      <InputBase
        value={shown}
        disabled={disabled}
        placeholder="How out"
        onFocus={(event) => event.target.select()}
        onClick={() => {
          if (!open) {
            setQ('')
            setH(0)
          }
        }}
        onChange={(event) => {
          setQ(event.target.value)
          setH(0)
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
        inputProps={{
          role: 'combobox',
          'aria-label': ariaLabel,
          'aria-expanded': open,
          'aria-controls': open ? listId : undefined,
          'aria-autocomplete': 'list',
          'aria-activedescendant': open && options[highlight] ? `${listId}-${options[highlight].type}` : undefined,
          'aria-description': auto ? 'Set automatically from the wickets' : undefined,
          autoComplete: 'off',
          'data-grid-cell': '',
          'data-grid-col': column,
        }}
        sx={{
          width: '100%',
          height: fullWidth ? 44 : 34,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          bgcolor: 'background.paper',
          fontWeight: 600,
          fontStyle: auto && !open ? 'italic' : 'normal',
          color: value === null && !open ? 'text.secondary' : 'text.primary',
          '& input': { px: 1, height: '100%', boxSizing: 'border-box', textOverflow: 'ellipsis' },
          '&.Mui-focused': { outline: 2, outlineStyle: 'solid', outlineColor: 'primary.main', outlineOffset: 1, borderColor: 'primary.main' },
          '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
        }}
      />
      {open && options.length > 0 && (
        <Paper
          id={listId}
          role="listbox"
          aria-label={`${ariaLabel}, options`}
          elevation={4}
          sx={{ position: 'absolute', zIndex: 5, top: '100%', left: 0, mt: 0.5, width: 230, maxHeight: 260, overflowY: 'auto', p: 0.5 }}
        >
          {options.map((option, index) => (
            <Box
              key={option.type}
              id={`${listId}-${option.type}`}
              role="option"
              aria-selected={index === highlight}
              // Keep the field focused so choosing does not blur it first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => accept(option.type)}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
                px: 1.25,
                py: 0.875,
                minHeight: { xs: 44, sm: 0 },
                alignItems: 'center',
                borderRadius: 1,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: index === highlight ? 700 : 400,
                bgcolor: index === highlight ? 'action.selected' : undefined,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <span>{option.label}</span>
              <Box component="kbd" sx={{ font: 'inherit', fontSize: 11, color: 'text.secondary' }}>
                {option.shortcut}
              </Box>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  )
}
