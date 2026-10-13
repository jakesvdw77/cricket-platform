import { useEffect, useRef, useState } from 'react'
import { Autocomplete, Box, Chip, CircularProgress, ListSubheader, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useQuery } from '@tanstack/react-query'
import { FieldFormDialog } from '../FieldFormDialog'
import { Input } from '../Input'
import { badgeSx } from '../RecordCard'
import { listPlayingAreas, playingAreasKey } from '../../api/playingAreaApi'
import type { FieldVerificationStatus, PlayingArea } from '../../api/playingAreaApi'
import { FIELD_CATEGORY_LABEL } from '../../utils/fieldLabels'

// Same debounce timing ClubPicker's club search uses.
const FIELD_SEARCH_DEBOUNCE_MS = 300
const PICKER_PAGE_SIZE = 20

const OUR_FIELDS = 'Our fields'
const OTHER_FIELDS = 'Other fields'

// What a match holds of its field: enough to show it and to flag it. The options the server returns are assignable to it.
export interface FieldPickerValue {
  id: string
  name: string
  // null when not known (a legacy match has no field at all); anything but UNVERIFIED or REJECTED shows no flag.
  verificationStatus: FieldVerificationStatus | null
}

export interface FieldPickerProps {
  value: FieldPickerValue | null
  onChange: (value: FieldPickerValue | null) => void
  clubId: string
  label?: string
  disabled?: boolean
  error?: boolean
  helperText?: string
}

// The last row of the list: opens the add-field dialog instead of selecting anything.
const ADD_OPTION = { id: '__add-new-field__', name: 'Add a new field...' } as const
type PickerOption = PlayingArea | typeof ADD_OPTION

const isAddOption = (option: PickerOption): option is typeof ADD_OPTION => option.id === ADD_OPTION.id

function groupOf(option: PickerOption): string {
  if (isAddOption(option)) return ''
  return option.linkedHome ? OUR_FIELDS : OTHER_FIELDS
}

// docs/specs/099-fields-directory.md: the match form's single Field box, built on ClubPicker's Autocomplete pattern - searched
// on the server as you type (300 ms debounce, nothing fetched before the first focus), the list kept as the server returns
// it (`filterOptions` off) and grouped Our fields then Other fields, each option showing the name, the city and an amber
// "Unverified" chip. The last row, "Add a new field...", opens the add-field dialog (a dialog on a desktop, a bottom sheet on
// a phone) and selects the new field when it is saved, leaving the host form untouched. Presentational about data: it takes
// value, onChange and clubId. It lists cricket fields only and never shows an area type or a ground.
export function FieldPicker({ value, onChange, clubId, label = 'Field (optional)', disabled = false, error = false, helperText }: FieldPickerProps) {
  const [hasFocused, setHasFocused] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  // Suppresses the dropdown right after a selection: re-syncing the input to the chosen name would otherwise search for it
  // and keep the popper open (the same trap ClubPicker documents). Cleared the moment the manager types again.
  const [suppressOpen, setSuppressOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  // Focus returns to the input when the dialog closes (and right after the "Add a new field..." click); it must not
  // reopen the dropdown. Cleared as soon as the manager opens or types in the box again.
  const ignoreFocusRef = useRef(false)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), FIELD_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  const { data: page, isFetching, isError } = useQuery({
    queryKey: [...playingAreasKey(clubId), 'picker', debouncedQuery],
    queryFn: () => listPlayingAreas(clubId, { page: 0, size: PICKER_PAGE_SIZE, q: debouncedQuery || undefined }),
    enabled: hasFocused && Boolean(clubId),
  })

  // The server puts home fields first, then by name; a stable sort by group keeps MUI's groups contiguous whatever it sends.
  const found = (page?.content ?? []).slice().sort((a, b) => Number(Boolean(b.linkedHome)) - Number(Boolean(a.linkedHome)))
  // A failed search must never be mistaken for "nothing matches, so add one" (ClubPicker's rule): no add row on error.
  const options: PickerOption[] = isError ? found : [...found, ADD_OPTION]
  const autocompleteOpen = hasFocused && !suppressOpen && !disabled && !dialogOpen

  return (
    <>
      <Autocomplete<PickerOption>
        open={autocompleteOpen}
        onOpen={() => {
          ignoreFocusRef.current = false
          setHasFocused(true)
          setSuppressOpen(false)
        }}
        // Controlled `open`: every close trigger (click away, Escape, the arrow) comes here instead.
        onClose={() => setSuppressOpen(true)}
        disabled={disabled}
        options={options}
        loading={isFetching}
        value={value as PickerOption | null}
        onFocus={() => {
          setHasFocused(true)
          if (ignoreFocusRef.current) return
          setSuppressOpen(false)
        }}
        onChange={(_event, next) => {
          if (!next) {
            onChange(null)
            return
          }
          setSuppressOpen(true)
          if (isAddOption(next)) {
            ignoreFocusRef.current = true
            setDialogOpen(true)
            return
          }
          onChange({ id: next.id, name: next.name, verificationStatus: next.verificationStatus })
        }}
        inputValue={query}
        onInputChange={(_event, next, reason) => {
          if (reason === 'input') {
            ignoreFocusRef.current = false
            setSuppressOpen(false)
            setQuery(next)
            return
          }
          // 'reset' follows a selection (sync the chosen name into the input) and fires with '' when the popper closes with
          // nothing chosen, which must not wipe a typed search; only 'clear' commits an empty value.
          if (reason === 'clear' || next) setQuery(next)
        }}
        groupBy={groupOf}
        getOptionLabel={(option) => (isAddOption(option) ? '' : option.name)}
        isOptionEqualToValue={(option, selected) => option.id === selected.id}
        filterOptions={(all) => all}
        renderGroup={(params) =>
          params.group ? (
            <li key={params.key}>
              <ListSubheader
                component="div"
                sx={{ lineHeight: 2, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                {params.group}
              </ListSubheader>
              <ul style={{ padding: 0 }}>{params.children}</ul>
            </li>
          ) : (
            <li key={params.key}>
              <ul style={{ padding: 0 }}>{params.children}</ul>
            </li>
          )
        }
        renderOption={(props, option) => {
          const { key, ...rest } = props as typeof props & { key: string }
          if (isAddOption(option)) {
            return (
              <Box
                component="li"
                key={key}
                {...rest}
                sx={{ gap: 1, fontWeight: 700, color: 'primary.main', borderTop: 1, borderColor: 'divider', minHeight: 44 }}
              >
                <AddIcon fontSize="small" />
                {ADD_OPTION.name}
              </Box>
            )
          }
          const place = [option.address.city, option.address.provinceState].filter(Boolean).join(', ')
          return (
            <Box component="li" key={key} {...rest} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, minHeight: 44 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2">{option.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {[place, FIELD_CATEGORY_LABEL[option.category]].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              {option.verificationStatus === 'UNVERIFIED' && (
                <Chip size="small" label="Unverified" sx={{ ...badgeSx('warning'), height: 20, fontSize: '0.6875rem', flex: 'none' }} />
              )}
            </Box>
          )
        }}
        renderInput={(params) => (
          <Input
            {...params}
            label={label}
            placeholder="Search by field name or city"
            error={error || isError}
            helperText={isError ? "Couldn't load fields. Please try again." : helperText}
            InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {isFetching && <CircularProgress color="inherit" size={16} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />

      <FieldFormDialog
        open={dialogOpen}
        onClose={() => {
          ignoreFocusRef.current = true
          setSuppressOpen(true)
          setDialogOpen(false)
        }}
        clubId={clubId}
        initialName={query.trim()}
        onCreated={(field) => {
          setSuppressOpen(true)
          onChange({ id: field.id, name: field.name, verificationStatus: field.verificationStatus })
        }}
      />
    </>
  )
}
