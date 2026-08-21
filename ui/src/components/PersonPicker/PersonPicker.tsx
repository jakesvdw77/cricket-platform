import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Autocomplete, Box, CircularProgress } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Input } from '../Input'
import { Button } from '../Button'
import { EmailInput } from '../EmailInput'
import { PhoneInput } from '../PhoneInput'
import { listPersons } from '../../api/personApi'
import type { Person } from '../../api/personApi'

// Same debounce timing ClubPicker established for its own search — see
// docs/plans/011-inline-club-creation-in-subscription-form.md item 3, mirrored here per
// docs/specs/014-subscription-responsible-contact.md's UI Requirements.
const PERSON_SEARCH_DEBOUNCE_MS = 300

export type PersonPickerValue =
  | { mode: 'existing'; id: string; firstName: string; lastName: string; email: string; phone: string | null }
  | { mode: 'new'; firstName: string; lastName: string; email: string; phone: string }
  | null

export interface PersonPickerProps {
  value: PersonPickerValue
  onChange: (value: PersonPickerValue) => void
  // Surfaces the consuming form's own "a responsible person is required" validation error
  // against the search field — only ever relevant while nothing has been selected yet (search
  // mode). Mirrors ClubPicker's requiredError prop exactly.
  requiredError?: string
  // Submit-time completeness errors from the consuming form, only ever relevant while already in
  // create mode — mirrors ClubPicker's nameError/slugError props.
  firstNameError?: string
  lastNameError?: string
  emailError?: string
}

export function PersonPicker({
  value,
  onChange,
  requiredError,
  firstNameError,
  lastNameError,
  emailError,
}: PersonPickerProps) {
  // Three states, unlike ClubPicker's two — an existing selection renders its own disabled
  // display (spec's UI Requirements) rather than staying inside the search Autocomplete.
  const mode: 'search' | 'create' | 'selected' =
    value?.mode === 'new' ? 'create' : value?.mode === 'existing' ? 'selected' : 'search'

  // Gates the search query behind the admin's first interaction — nothing fetches before the
  // field is ever focused, same as ClubPicker's own hasFocused.
  const [hasFocused, setHasFocused] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), PERSON_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  const { data: personPage, isFetching, isError } = useQuery({
    queryKey: ['person-picker-persons', debouncedQuery],
    queryFn: () => listPersons({ page: 0, size: 10, search: debouncedQuery || undefined }),
    enabled: hasFocused && mode === 'search',
  })
  const personOptions: Person[] = personPage?.content ?? []

  // A genuine fetch failure must never be silently treated as "no matching people" — that would
  // offer to create a new (possibly duplicate) Person off a transient network/auth error instead
  // of surfacing the failure. Copied verbatim from ClubPicker's own fix, per plan Flag 7.
  const showAddAffordance = hasFocused && mode === 'search' && !isFetching && !isError && personOptions.length === 0
  const trimmedQuery = query.trim()
  // Same rationale as ClubPicker's own autocompleteOpen — the popper's "No people found" text
  // would otherwise visually overlap the "+ Add" affordance rendered right below it.
  const autocompleteOpen = hasFocused && (isFetching || personOptions.length > 0)

  const handleStartCreate = () => {
    // Email pre-fills from the query only if it looks like one (contains '@') — otherwise the
    // query is treated as a name hint and email starts blank, per spec's UI Requirements.
    const looksLikeEmail = trimmedQuery.includes('@')
    onChange({
      mode: 'new',
      firstName: looksLikeEmail ? '' : trimmedQuery,
      lastName: '',
      email: looksLikeEmail ? trimmedQuery : '',
      phone: '',
    })
  }

  // Discards the draft/selection with no side effects — nothing was ever created, so there's
  // nothing to undo server-side. Reused for both create mode's "Back to search" and selected
  // mode's "Change" affordance.
  const handleBackToSearch = () => {
    setQuery('')
    onChange(null)
  }

  const handleFieldChange = (field: 'firstName' | 'lastName') => (event: ChangeEvent<HTMLInputElement>) => {
    if (value?.mode !== 'new') {
      return
    }
    onChange({ ...value, [field]: event.target.value })
  }

  const handleEmailChange = (email: string) => {
    if (value?.mode !== 'new') {
      return
    }
    onChange({ ...value, email })
  }

  const handlePhoneChange = (phone: string) => {
    if (value?.mode !== 'new') {
      return
    }
    onChange({ ...value, phone })
  }

  // Root spans the full grid row (see RecordFormScreen's "full-width fields" convention) — this
  // component can render more than one field at a time, so it lays those out itself rather than
  // each becoming its own cell in the parent form's two-column grid. Mirrors ClubPicker exactly.
  return (
    <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {mode === 'search' && (
        <>
          <Autocomplete<Person>
            open={autocompleteOpen}
            onOpen={() => setHasFocused(true)}
            onClose={() => {}}
            options={personOptions}
            loading={isFetching}
            value={null}
            onFocus={() => setHasFocused(true)}
            onChange={(_event, newValue) => {
              if (newValue) {
                onChange({
                  mode: 'existing',
                  id: newValue.id,
                  firstName: newValue.firstName,
                  lastName: newValue.lastName,
                  email: newValue.email,
                  phone: newValue.phone,
                })
              }
            }}
            inputValue={query}
            onInputChange={(_event, newInputValue, reason) => {
              if (reason === 'input') {
                setQuery(newInputValue)
                return
              }
              // Same reasoning as ClubPicker's own onInputChange — 'reset' fires both after a
              // real selection (handled by switching to 'selected' mode above, which unmounts
              // this Autocomplete entirely) and whenever the popper closes with nothing
              // selected; only sync the typed query back in the latter case, or on an explicit
              // 'clear', so a zero-result search query used by the "+ Add" affordance survives.
              if (reason === 'clear' || newInputValue) {
                setQuery(newInputValue)
              }
            }}
            getOptionLabel={(option) => `${option.firstName} ${option.lastName} — ${option.email}`}
            isOptionEqualToValue={(option, optionValue) => option.id === optionValue.id}
            filterOptions={(options) => options}
            renderInput={(params) => (
              <Input
                {...params}
                label="Responsible person"
                placeholder="Search by name or email"
                error={Boolean(requiredError) || isError}
                helperText={isError ? "Couldn't load people. Please try again." : requiredError}
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
              {trimmedQuery ? `+ Add "${trimmedQuery}" as a new person` : '+ Add a new person'}
            </Button>
          )}
        </>
      )}

      {mode === 'create' && value?.mode === 'new' && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Input
              label="First name"
              value={value.firstName}
              onChange={handleFieldChange('firstName')}
              error={Boolean(firstNameError)}
              helperText={firstNameError}
            />
            <Input
              label="Last name"
              value={value.lastName}
              onChange={handleFieldChange('lastName')}
              error={Boolean(lastNameError)}
              helperText={lastNameError}
            />
            <EmailInput value={value.email} onChange={handleEmailChange} error={emailError} />
            <PhoneInput value={value.phone} onChange={handlePhoneChange} />
          </Box>
          <Button variant="ghost" size="sm" onClick={handleBackToSearch} sx={{ alignSelf: 'flex-start' }}>
            Back to search
          </Button>
        </>
      )}

      {mode === 'selected' && value?.mode === 'existing' && (
        <>
          {/* Disabled/read-only display — the UI's own visible reinforcement of the backend's
              "link, don't overwrite" rule, never editable from this component. */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Input label="First name" value={value.firstName} disabled />
            <Input label="Last name" value={value.lastName} disabled />
            <Input label="Email" value={value.email} disabled />
            <Input label="Phone" value={value.phone ?? ''} disabled />
          </Box>
          <Button variant="ghost" size="sm" onClick={handleBackToSearch} sx={{ alignSelf: 'flex-start' }}>
            Change
          </Button>
        </>
      )}
    </Box>
  )
}
