import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Autocomplete, Box, CircularProgress } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Input } from '../Input'
import { Button } from '../Button'
import { listClubs } from '../../api/clubApi'
import type { Club } from '../../api/clubApi'
import { deriveSlug, SLUG_PATTERN } from '../../utils/slug'

// Same debounce timing SubscriptionForm's old inline Club Autocomplete used before this
// component absorbed it — see docs/plans/011-inline-club-creation-in-subscription-form.md item 3.
const CLUB_SEARCH_DEBOUNCE_MS = 300

export type ClubPickerValue =
  | { mode: 'existing'; id: string; name: string }
  | { mode: 'new'; name: string; slug: string }
  | null

// Only the fields the search dropdown actually renders/compares — the fetched list carries the
// full Club shape too, which is structurally assignable here (extra fields simply unused).
type ClubOption = Pick<Club, 'id' | 'name'>

export interface ClubPickerProps {
  value: ClubPickerValue
  onChange: (value: ClubPickerValue) => void
  // Surfaces a server-side club-creation failure (reserved slug, duplicate slug) against the
  // Slug field — only ever relevant while already in create mode, see
  // docs/specs/011-inline-club-creation-in-subscription-form.md's UI Requirements.
  error?: string
  // Surfaces the consuming form's own "a club selection is required" validation error against
  // the search field — only ever relevant while nothing has been selected yet (search mode),
  // kept separate from `error` above since that one only makes sense once already in create mode
  // and the two can never be relevant at the same time.
  requiredError?: string
}

export function ClubPicker({ value, onChange, error, requiredError }: ClubPickerProps) {
  const mode: 'search' | 'create' = value?.mode === 'new' ? 'create' : 'search'

  // Gates the search query behind the admin's first interaction — nothing fetches before the
  // field is ever focused, matching the plan's "hasFocused" requirement.
  const [hasFocused, setHasFocused] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  // Once the admin has explicitly edited the slug directly, stop auto-deriving it from the name
  // — same "suggest until touched" convention as ClubForm's own slugTouched.
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), CLUB_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  const { data: clubPage, isFetching } = useQuery({
    queryKey: ['club-picker-clubs', debouncedQuery],
    queryFn: () => listClubs({ page: 0, size: 10, search: debouncedQuery || undefined, sort: 'name,asc' }),
    enabled: hasFocused && mode === 'search',
  })
  // The admin endpoint returns every Club status (010's own list screen needs SUSPENDED/
  // ONBOARDING too) — a Subscription should only ever attach to an ACTIVE club, so filter
  // client-side rather than asking the backend for a status this endpoint doesn't filter by.
  const clubOptions: ClubOption[] = (clubPage?.content ?? []).filter((club) => club.status === 'ACTIVE')

  const selectedOption: ClubOption | null = value?.mode === 'existing' ? { id: value.id, name: value.name } : null

  const showAddAffordance = hasFocused && mode === 'search' && !isFetching && clubOptions.length === 0
  const trimmedQuery = query.trim()
  // MUI's own dropdown popper is absolutely positioned, so leaving it open with nothing useful
  // inside (its "No clubs found" noOptionsText) visually overlaps the "+ Add" affordance
  // rendered right below it in normal flow — a real admin can't see or click the button until
  // the popper closes. Closing it explicitly the moment there's nothing to show hands that
  // space to the affordance instead, rather than fighting z-index/positioning to work around it.
  const autocompleteOpen = hasFocused && (isFetching || clubOptions.length > 0)

  const handleStartCreate = () => {
    setSlugTouched(false)
    onChange({ mode: 'new', name: trimmedQuery, slug: deriveSlug(trimmedQuery) })
  }

  const handleBackToSearch = () => {
    setSlugTouched(false)
    onChange(null)
  }

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (value?.mode !== 'new') {
      return
    }
    const name = event.target.value
    onChange({ mode: 'new', name, slug: slugTouched ? value.slug : deriveSlug(name) })
  }

  const handleSlugChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (value?.mode !== 'new') {
      return
    }
    setSlugTouched(true)
    onChange({ mode: 'new', name: value.name, slug: event.target.value })
  }

  // Root spans the full grid row (see RecordFormScreen's "full-width fields" convention) — this
  // component can render more than one field at a time (search input + affordance, or Name +
  // Slug + Back-to-search), so it lays those out itself rather than each becoming its own cell
  // in the parent form's two-column grid.
  return (
    <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {mode === 'search' && (
        <>
          <Autocomplete<ClubOption>
            open={autocompleteOpen}
            onOpen={() => setHasFocused(true)}
            onClose={() => {}}
            options={clubOptions}
            loading={isFetching}
            value={selectedOption}
            onFocus={() => setHasFocused(true)}
            onChange={(_event, newValue) => {
              onChange(newValue ? { mode: 'existing', id: newValue.id, name: newValue.name } : null)
            }}
            inputValue={query}
            onInputChange={(_event, newInputValue, reason) => {
              if (reason === 'input') {
                setQuery(newInputValue)
              }
            }}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, optionValue) => option.id === optionValue.id}
            filterOptions={(options) => options}
            renderInput={(params) => (
              <Input
                {...params}
                label="Club"
                placeholder="Search by club name"
                error={Boolean(requiredError)}
                helperText={requiredError}
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

          {showAddAffordance && (
            <Button variant="ghost" size="sm" onClick={handleStartCreate} sx={{ alignSelf: 'flex-start' }}>
              {trimmedQuery ? `+ Add "${trimmedQuery}" as a new club` : '+ Add a new club'}
            </Button>
          )}
        </>
      )}

      {mode === 'create' && value?.mode === 'new' && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Input label="Name" value={value.name} onChange={handleNameChange} />
            <Input
              label="Slug"
              value={value.slug}
              onChange={handleSlugChange}
              error={Boolean(error) || Boolean(slugFormatError(value.slug))}
              helperText={
                error ??
                slugFormatError(value.slug) ??
                (!slugTouched && value.slug
                  ? 'Auto-filled from name — edit to override'
                  : 'Lowercase letters, numbers, and hyphens, e.g. riverside-cc')
              }
            />
          </Box>
          <Button variant="ghost" size="sm" onClick={handleBackToSearch} sx={{ alignSelf: 'flex-start' }}>
            Back to search
          </Button>
        </>
      )}
    </Box>
  )
}

// Immediate client-side feedback only (mirrors ClubForm's own validate()'s slug checks) —
// independent of the `error` prop, which is reserved for the server-side rejection surfaced on
// actual Subscription-form submit.
function slugFormatError(slug: string): string | undefined {
  const trimmed = slug.trim()
  if (!trimmed) {
    return undefined
  }
  if (trimmed.length < 3 || trimmed.length > 63) {
    return 'Slug must be between 3 and 63 characters'
  }
  if (!SLUG_PATTERN.test(trimmed)) {
    return 'Use lowercase letters, numbers, and single hyphens, e.g. riverside-cc'
  }
  return undefined
}
