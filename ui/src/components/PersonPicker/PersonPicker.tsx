import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Autocomplete, Box, CircularProgress, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Input } from '../Input'
import { Button } from '../Button'
import { EmailInput } from '../EmailInput'
import { PhoneInput } from '../PhoneInput'
import { listPersons } from '../../api/personApi'
import type { Person } from '../../api/personApi'

// Same debounce timing ClubPicker established for its own search — see
// docs/plans/011-inline-club-creation-in-subscription-form.md item 3.
const PERSON_SEARCH_DEBOUNCE_MS = 300

export type PersonPickerValue =
  | { mode: 'existing'; id: string; firstName: string; lastName: string; email: string; phone: string | null }
  | { mode: 'new'; firstName: string; lastName: string; email: string; phone: string }
  | null

export interface PersonPickerProps {
  value: PersonPickerValue
  onChange: (value: PersonPickerValue) => void
  // Shown against the create-mode fields when nothing has been entered at all (value is still
  // null) — only ever relevant in that state, since a partial 'new' draft instead surfaces the
  // three field-level errors below. Mirrors ClubPicker's requiredError prop in spirit, not shape.
  requiredError?: string
  firstNameError?: string
  lastNameError?: string
  emailError?: string
}

const BLANK_DRAFT = { mode: 'new' as const, firstName: '', lastName: '', email: '', phone: '' }

export function PersonPicker({
  value,
  onChange,
  requiredError,
  firstNameError,
  lastNameError,
  emailError,
}: PersonPickerProps) {
  // Defaults to create mode — creating a Subscription almost always means a brand-new
  // responsible person, not one who already exists. The original search-first design (mirroring
  // ClubPicker) made the common case the awkward one: real-world use surfaced that admins were
  // never offered a "+ Add" option because the on-focus default list is rarely empty. "Link to
  // an existing person instead" is now the deliberately secondary path, for the rarer case where
  // the same person already manages another club — see docs/specs/014-subscription-responsible-
  // contact.md's UI Requirements for the full reasoning behind this reversal.
  const [showSearch, setShowSearch] = useState(false)
  const mode: 'search' | 'create' | 'selected' =
    value?.mode === 'existing' ? 'selected' : showSearch ? 'search' : 'create'

  // Gates the search query behind the admin's first interaction — nothing fetches before the
  // field is ever focused, same as ClubPicker's own hasFocused.
  const [hasFocused, setHasFocused] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  // Same suppressOpen mechanism ClubPicker uses (see its own comment for the full reasoning) —
  // without it, a controlled `open` prop never reacts to MUI's own close triggers (click-away,
  // Escape, the dropdown arrow), only to a real selection, so the popper stayed open regardless
  // of what the admin did short of picking an option.
  const [suppressOpen, setSuppressOpen] = useState(false)

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

  const trimmedQuery = query.trim()
  const autocompleteOpen = hasFocused && !suppressOpen && (isFetching || personOptions.length > 0)

  const startSearch = () => {
    setShowSearch(true)
  }

  // Leaves search mode. If the admin had typed something before giving up on finding an existing
  // match, carry it into the new draft — email-shaped text becomes the email, anything else
  // becomes a name hint — same heuristic the old "+ Add" affordance used. An empty query leaves
  // whatever draft (or blank state) already existed untouched, so a detour into search-and-back
  // never silently discards fields the admin had already filled in.
  const startCreate = () => {
    setShowSearch(false)
    if (trimmedQuery) {
      const looksLikeEmail = trimmedQuery.includes('@')
      onChange({
        mode: 'new',
        firstName: looksLikeEmail ? '' : trimmedQuery,
        lastName: '',
        email: looksLikeEmail ? trimmedQuery : '',
        phone: '',
      })
    }
    setQuery('')
  }

  // Discards an existing selection with no side effects — nothing was ever created, so there's
  // nothing to undo server-side. Returns to create mode (the default), not search.
  const handleChangeSelection = () => {
    setShowSearch(false)
    setQuery('')
    onChange(null)
  }

  const currentDraft = value?.mode === 'new' ? value : BLANK_DRAFT

  const handleFieldChange = (field: 'firstName' | 'lastName') => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...currentDraft, [field]: event.target.value })
  }

  const handleEmailChange = (email: string) => {
    onChange({ ...currentDraft, email })
  }

  const handlePhoneChange = (phone: string) => {
    onChange({ ...currentDraft, phone })
  }

  // Root spans the full grid row (see RecordFormScreen's "full-width fields" convention) — this
  // component can render more than one field at a time, so it lays those out itself rather than
  // each becoming its own cell in the parent form's two-column grid. Mirrors ClubPicker exactly.
  return (
    <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {mode === 'search' && (
        <>
          {/* Rendered above the Autocomplete, not below — this button is always visible now
              (not just when results are empty, per the reasoning above), and MUI's dropdown
              popper is absolutely positioned below the field, so placing the button underneath
              would let an open popper full of real results visually cover it. */}
          <Button variant="ghost" size="sm" onClick={startCreate} sx={{ alignSelf: 'flex-start' }}>
            {trimmedQuery ? `Create "${trimmedQuery}" as a new person instead` : 'Create a new person instead'}
          </Button>

          <Autocomplete<Person>
            open={autocompleteOpen}
            onOpen={() => {
              setHasFocused(true)
              setSuppressOpen(false)
            }}
            // See ClubPicker's identical onClose for why this can't be a no-op — a controlled
            // `open` prop otherwise never reacts to MUI's own close triggers (click-away,
            // Escape, the dropdown arrow).
            onClose={() => setSuppressOpen(true)}
            options={personOptions}
            loading={isFetching}
            value={null}
            onFocus={() => {
              setHasFocused(true)
              setSuppressOpen(false)
            }}
            onChange={(_event, newValue) => {
              if (newValue) {
                setShowSearch(false)
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
                setSuppressOpen(false)
                setQuery(newInputValue)
                return
              }
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
                label="Search for an existing person"
                placeholder="Search by name or email"
                error={isError}
                helperText={isError ? "Couldn't load people. Please try again." : undefined}
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
        </>
      )}

      {mode === 'create' && (
        <>
          {requiredError && (
            <Typography variant="body2" color="error.main">
              {requiredError}
            </Typography>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Input
              label="First name"
              value={currentDraft.firstName}
              onChange={handleFieldChange('firstName')}
              error={Boolean(firstNameError)}
              helperText={firstNameError}
            />
            <Input
              label="Last name"
              value={currentDraft.lastName}
              onChange={handleFieldChange('lastName')}
              error={Boolean(lastNameError)}
              helperText={lastNameError}
            />
            <EmailInput value={currentDraft.email} onChange={handleEmailChange} error={emailError} />
            <PhoneInput value={currentDraft.phone} onChange={handlePhoneChange} />
          </Box>
          <Button variant="ghost" size="sm" onClick={startSearch} sx={{ alignSelf: 'flex-start' }}>
            Link to an existing person instead
          </Button>
        </>
      )}

      {mode === 'selected' && value?.mode === 'existing' && (
        <>
          {/* Disabled/read-only display — the UI's own visible reinforcement of the backend's
              "link, don't overwrite" rule, never editable from this component. Also the visible
              confirmation that this Subscription is about to link an *existing* identity — e.g.
              one already responsible for another Club — before the admin submits. */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Input label="First name" value={value.firstName} disabled />
            <Input label="Last name" value={value.lastName} disabled />
            <Input label="Email" value={value.email} disabled />
            <Input label="Phone" value={value.phone ?? ''} disabled />
          </Box>
          <Button variant="ghost" size="sm" onClick={handleChangeSelection} sx={{ alignSelf: 'flex-start' }}>
            Change
          </Button>
        </>
      )}
    </Box>
  )
}
