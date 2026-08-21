import { useEffect, useState } from 'react'
import { Autocomplete, Box, CircularProgress } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Input } from '../Input'
import { Button } from '../Button'
import { ClubNameSlugFields } from '../ClubNameSlugFields'
import { listClubs } from '../../api/clubApi'
import type { Club } from '../../api/clubApi'
import { deriveSlug, validateSlug } from '../../utils/slug'

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
  // Submit-time "Name is required" validation from the consuming form, only ever relevant while
  // already in create mode — see docs/specs/011-inline-club-creation-in-subscription-form.md's
  // UI Requirements ("reusing 010's ClubForm-shaped fields and validation").
  nameError?: string
  // Either a submit-time slug validation error from the consuming form, or a server-side
  // club-creation failure (reserved slug, duplicate slug) surfaced after a failed submit — both
  // render against the Slug field, only ever relevant while already in create mode.
  slugError?: string
  // Surfaces the consuming form's own "a club selection is required" validation error against
  // the search field — only ever relevant while nothing has been selected yet (search mode),
  // kept separate from the two above since those only make sense once already in create mode
  // and none of the three can ever be relevant at the same time.
  requiredError?: string
}

export function ClubPicker({ value, onChange, nameError, slugError, requiredError }: ClubPickerProps) {
  const mode: 'search' | 'create' = value?.mode === 'new' ? 'create' : 'search'

  // Gates the search query behind the admin's first interaction — nothing fetches before the
  // field is ever focused, matching the plan's "hasFocused" requirement.
  const [hasFocused, setHasFocused] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  // Suppresses the dropdown immediately after a real selection. Without this, picking an option
  // never visibly closes the popper: selecting re-syncs `query` to the chosen club's name (see
  // onInputChange below), which re-triggers the same search and gets the same single match back
  // — so `clubOptions.length > 0` stays true and `autocompleteOpen` never drops to false. Cleared
  // the moment the admin actually types again, so searching for a different club still works.
  const [suppressOpen, setSuppressOpen] = useState(false)
  // Once the admin has explicitly edited the slug directly, stop auto-deriving it from the name
  // — same "suggest until touched" convention as ClubForm's own slugTouched.
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), CLUB_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  const { data: clubPage, isFetching, isError } = useQuery({
    queryKey: ['club-picker-clubs', debouncedQuery],
    queryFn: () => listClubs({ page: 0, size: 10, search: debouncedQuery || undefined, sort: 'name,asc' }),
    enabled: hasFocused && mode === 'search',
  })
  // The admin endpoint returns every Club status (010's own list screen needs SUSPENDED/
  // ONBOARDING too) — a Subscription should only ever attach to an ACTIVE club, so filter
  // client-side rather than asking the backend for a status this endpoint doesn't filter by.
  const clubOptions: ClubOption[] = (clubPage?.content ?? []).filter((club) => club.status === 'ACTIVE')

  const selectedOption: ClubOption | null = value?.mode === 'existing' ? { id: value.id, name: value.name } : null

  // A genuine fetch failure must never be silently treated as "no matching clubs" — that would
  // offer to create a new (possibly duplicate) Club off a transient network/auth error instead
  // of surfacing the failure. Found during standards review of the initial implementation.
  const showAddAffordance = hasFocused && mode === 'search' && !isFetching && !isError && clubOptions.length === 0
  const trimmedQuery = query.trim()
  // MUI's own dropdown popper is absolutely positioned, so leaving it open with nothing useful
  // inside (its "No clubs found" noOptionsText) visually overlaps the "+ Add" affordance
  // rendered right below it in normal flow — a real admin can't see or click the button until
  // the popper closes. Closing it explicitly the moment there's nothing to show hands that
  // space to the affordance instead, rather than fighting z-index/positioning to work around it.
  const autocompleteOpen = hasFocused && !suppressOpen && (isFetching || clubOptions.length > 0)

  const handleStartCreate = () => {
    setSlugTouched(false)
    onChange({ mode: 'new', name: trimmedQuery, slug: deriveSlug(trimmedQuery) })
  }

  const handleBackToSearch = () => {
    setSlugTouched(false)
    onChange(null)
  }

  const handleNameChange = (name: string) => {
    if (value?.mode !== 'new') {
      return
    }
    onChange({ mode: 'new', name, slug: slugTouched ? value.slug : deriveSlug(name) })
  }

  const handleSlugChange = (slug: string) => {
    if (value?.mode !== 'new') {
      return
    }
    setSlugTouched(true)
    onChange({ mode: 'new', name: value.name, slug })
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
            onFocus={() => {
              setHasFocused(true)
              setSuppressOpen(false)
            }}
            onChange={(_event, newValue) => {
              if (newValue) {
                setSuppressOpen(true)
              }
              onChange(newValue ? { mode: 'existing', id: newValue.id, name: newValue.name } : null)
            }}
            inputValue={query}
            onInputChange={(_event, newInputValue, reason) => {
              if (reason === 'input') {
                setSuppressOpen(false)
                setQuery(newInputValue)
                return
              }
              // 'reset' fires both after a real selection (newInputValue is the selected
              // club's name — sync it so the field actually shows what got picked, a real bug
              // found during manual browser verification) and whenever the popper closes with
              // nothing selected, including our own controlled `open` closing itself once
              // there are zero results (newInputValue is '' there) — syncing that case would
              // wipe out a typed search query the "+ Add" affordance still needs to show. Only
              // 'clear' (the field's own clear button) should still commit an empty value.
              if (reason === 'clear' || newInputValue) {
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
                error={Boolean(requiredError) || isError}
                helperText={isError ? "Couldn't load clubs. Please try again." : requiredError}
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
            <ClubNameSlugFields
              name={value.name}
              slug={value.slug}
              slugTouched={slugTouched}
              nameError={nameError}
              // Prefers the consuming form's own error (a submit-time "required" check, or a
              // server-side reserved/duplicate-slug rejection) over the live format check below
              // — once the form has actually tried to submit, that's the more authoritative,
              // specific message. The live check still runs meanwhile so a malformed (but
              // non-blank) slug gets immediate feedback while typing, same as ClubForm.
              slugError={slugError ?? liveSlugError(value.slug)}
              onNameChange={handleNameChange}
              onSlugChange={handleSlugChange}
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

// Live-while-typing feedback only, deliberately blank-inert — same "don't nag before the admin
// has even started" convention as the rest of this codebase's submit-triggered validate()
// functions, which is why this doesn't just call validateSlug() directly (that flags blank as
// "required", which belongs to the submit-time `slugError` prop above, not live typing).
function liveSlugError(slug: string): string | undefined {
  return slug.trim() ? validateSlug(slug) : undefined
}
