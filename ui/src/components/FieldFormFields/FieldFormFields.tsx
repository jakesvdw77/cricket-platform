import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Chip, MenuItem, ToggleButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import { useQuery } from '@tanstack/react-query'
import { AddressFields } from '../AddressFields'
import { Button } from '../Button'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { FormSectionHeading } from '../FormSectionHeading'
import { Input } from '../Input'
import { badgeSx } from '../RecordCard'
import { findSimilarPlayingAreas, getPlayingArea, playingAreasKey } from '../../api/playingAreaApi'
import type { FieldCategory, FieldOwnerType, PlayingArea } from '../../api/playingAreaApi'
import { countryName } from '../../utils/countries'
import { FIELD_CATEGORIES, FIELD_CATEGORY_LABEL, FIELD_OWNER_TYPES, FIELD_OWNER_TYPE_LABEL } from '../../utils/fieldLabels'
import { effectiveOwnerType, MAX_MAP_URL_LENGTH, MAX_NAME_LENGTH, MAX_NOTES_LENGTH } from '../../utils/fieldForm'
import type { FieldFormErrors, FieldFormValues } from '../../utils/fieldForm'
import { fieldStatusBadge, fieldStatusOf } from '../../utils/fieldStatus'

export interface FieldFormFieldsProps {
  values: FieldFormValues
  onChange: (patch: Partial<FieldFormValues>) => void
  errors?: FieldFormErrors
  // 'page' is the full Add / Edit field form (three sections); 'dialog' is the small one the match form's picker opens:
  // name, type, owner, address and an optional map link, with no owner type, postal code or notes.
  variant?: 'page' | 'dialog'
  disabled?: boolean
  // The calling club, for the "Did you mean" lookup. Without it (or with `suggest` off) no lookup is made.
  clubId?: string
  // Create only: Name and City trigger the lookup of existing fields before Save.
  suggest?: boolean
  // After a 409 DuplicateField: the existing field's id, offered in the same panel.
  duplicateOfId?: string | null
  onUseExisting?: (field: PlayingArea) => void
  // Shown under Country on a create form.
  countryHint?: string
}

const SUGGEST_DEBOUNCE_MS = 400
const MIN_NAME_FOR_SUGGEST = 3

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handle)
  }, [value, delay])
  return debounced
}

function ExistingFieldRow({ field, onUse }: { field: PlayingArea; onUse?: (field: PlayingArea) => void }) {
  const badge = fieldStatusBadge(fieldStatusOf(field))
  const place = [field.address.city, field.address.provinceState].filter(Boolean).join(', ')
  return (
    <Box
      data-testid="field-suggestion"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        px: 1.5,
        py: 1,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700}>
          {field.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
          {[place, FIELD_CATEGORY_LABEL[field.category]].filter(Boolean).join(' · ')}
          <Chip size="small" label={badge.label} sx={{ ...badgeSx(badge.tone), height: 20, fontSize: '0.6875rem' }} />
        </Typography>
      </Box>
      {onUse && (
        <Button variant="secondary" size="sm" onClick={() => onUse(field)}>
          Use this field
        </Button>
      )}
    </Box>
  )
}

// The panel above the Save button: "Did you mean one of these?" (similar existing fields, or the exact duplicate the
// server reported). Using a field links it to the club instead of creating another; "No, this is a different field"
// dismisses the suggestions for what is typed now.
function SimilarFieldsPanel({
  clubId,
  name,
  city,
  country,
  duplicateOfId,
  onUseExisting,
}: {
  clubId: string
  name: string
  city: string
  country: string
  duplicateOfId?: string | null
  onUseExisting?: (field: PlayingArea) => void
}) {
  const typed = useDebounced({ name: name.trim(), city: city.trim(), country: country.trim() }, SUGGEST_DEBOUNCE_MS)
  const key = `${typed.name}|${typed.city}|${typed.country}`.toLowerCase()
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  const similarQuery = useQuery({
    queryKey: [...playingAreasKey(clubId), 'similar', typed],
    queryFn: () => findSimilarPlayingAreas(clubId, { name: typed.name, city: typed.city || undefined, country: typed.country || undefined }),
    enabled: typed.name.length >= MIN_NAME_FOR_SUGGEST && typed.city.length > 0,
    retry: false,
  })

  const duplicateQuery = useQuery({
    queryKey: [...playingAreasKey(clubId), 'detail', duplicateOfId],
    queryFn: () => getPlayingArea(clubId, duplicateOfId as string),
    enabled: Boolean(duplicateOfId),
    retry: false,
  })

  if (duplicateOfId && duplicateQuery.data) {
    return (
      <PanelShell>
        <Typography variant="body2">
          <b>This field already exists.</b> Use it instead of adding it again.
        </Typography>
        <ExistingFieldRow field={duplicateQuery.data} onUse={onUseExisting} />
      </PanelShell>
    )
  }

  const suggestions = similarQuery.data ?? []
  if (suggestions.length === 0 || dismissedKey === key) return null

  return (
    <PanelShell>
      <Typography variant="body2">
        <b>Did you mean one of these?</b>{' '}
        {typed.country ? `These fields already exist in ${countryName(typed.country)}.` : 'These fields already exist.'}
      </Typography>
      {suggestions.map((field) => (
        <ExistingFieldRow key={field.id} field={field} onUse={onUseExisting} />
      ))}
      <Box>
        <Button variant="ghost" size="sm" onClick={() => setDismissedKey(key)}>
          No, this is a different field
        </Button>
      </Box>
    </PanelShell>
  )
}

function PanelShell({ children }: { children: ReactNode }) {
  return (
    <Box
      role="region"
      aria-label="Did you mean"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        border: '1px dashed',
        borderColor: 'warning.main',
        bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
        borderRadius: 1,
        p: 1.5,
      }}
    >
      {children}
    </Box>
  )
}

// docs/specs/099-fields-directory.md: the one body of the field form - the full page and the match form's add-field dialog
// both render it, so the two cannot drift. Controlled (values in, patch out); the page or dialog owns the <form>, the
// Save button and the mutation. Never shows an area-type or ground control: a manager only ever sees Field.
export function FieldFormFields({
  values,
  onChange,
  errors = {},
  variant = 'page',
  disabled = false,
  clubId,
  suggest = false,
  duplicateOfId,
  onUseExisting,
  countryHint,
}: FieldFormFieldsProps) {
  const dialog = variant === 'dialog'
  const columns = dialog
    ? { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }
    : { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }
  const spanTwo = dialog ? { sm: 'span 2' } : { md: 'span 2' }
  const gridSx = { display: 'grid', gap: 2, gridTemplateColumns: columns, alignItems: 'start' } as const
  const wrapFrom = dialog ? 'sm' : 'md'

  const typeToggle = (
    <Box sx={dialog ? { gridColumn: spanTwo } : undefined}>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        Type
      </Typography>
      <CompactToggleGroup<FieldCategory> value={values.category} onChange={(category) => onChange({ category })} ariaLabel="Type" fullWidthOnPhone>
        {FIELD_CATEGORIES.map((category) => (
          <ToggleButton key={category} value={category} aria-label={FIELD_CATEGORY_LABEL[category]} disabled={disabled}>
            {FIELD_CATEGORY_LABEL[category]}
          </ToggleButton>
        ))}
      </CompactToggleGroup>
    </Box>
  )

  const nameInput = (
    <Box sx={{ gridColumn: spanTwo }}>
      <Input
        label="Name"
        value={values.name}
        onChange={(event) => onChange({ name: event.target.value })}
        error={Boolean(errors.name)}
        helperText={errors.name}
        disabled={disabled}
        inputProps={{ maxLength: MAX_NAME_LENGTH }}
      />
    </Box>
  )

  const ownerInput = (
    <Box sx={dialog ? undefined : { gridColumn: spanTwo }}>
      <Input
        label="Owner"
        value={values.ownerName}
        onChange={(event) => onChange({ ownerName: event.target.value })}
        error={Boolean(errors.ownerName)}
        helperText={errors.ownerName ?? (dialog ? undefined : 'The owner of the land, even if your club only manages it')}
        disabled={disabled}
        inputProps={{ maxLength: MAX_NAME_LENGTH }}
      />
    </Box>
  )

  const similarPanel =
    clubId && (suggest || duplicateOfId) ? (
      <Box sx={{ gridColumn: '1 / -1' }}>
        <SimilarFieldsPanel
          clubId={clubId}
          name={suggest ? values.name : ''}
          city={values.address.city ?? ''}
          country={values.address.country ?? ''}
          duplicateOfId={duplicateOfId}
          onUseExisting={onUseExisting}
        />
      </Box>
    ) : null

  const mapInput = (
    <Box sx={{ gridColumn: spanTwo }}>
      <Input
        label="Map link (optional)"
        placeholder="https://maps.app.goo.gl/…"
        value={values.mapUrl}
        onChange={(event) => onChange({ mapUrl: event.target.value })}
        error={Boolean(errors.mapUrl)}
        helperText={errors.mapUrl}
        disabled={disabled}
        inputProps={{ maxLength: MAX_MAP_URL_LENGTH }}
        InputLabelProps={{ shrink: true }}
      />
    </Box>
  )

  if (dialog) {
    return (
      <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={gridSx}>
          {nameInput}
          {typeToggle}
          {ownerInput}
          <AddressFields
            value={values.address}
            onChange={(address) => onChange({ address })}
            isoCountry
            fields={['city', 'provinceState', 'country', 'street']}
            wide={['street']}
            wideFrom={wrapFrom}
            optional={['street', 'provinceState']}
            errors={{ street: errors.street, city: errors.city, country: errors.country }}
            disabled={disabled}
          />
          {mapInput}
          {similarPanel}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <FormSectionHeading icon={<InfoOutlinedIcon />} title="Basic info" />
      <Box sx={gridSx}>
        {nameInput}
        {typeToggle}
        <Input
          select
          label="Owner type"
          value={effectiveOwnerType(values)}
          onChange={(event) => onChange({ ownerType: event.target.value as FieldOwnerType })}
          disabled={disabled}
        >
          {FIELD_OWNER_TYPES.map((ownerType) => (
            <MenuItem key={ownerType} value={ownerType}>
              {FIELD_OWNER_TYPE_LABEL[ownerType]}
            </MenuItem>
          ))}
        </Input>
        {ownerInput}
        {similarPanel}
      </Box>

      <FormSectionHeading icon={<PlaceOutlinedIcon />} title="Address" />
      <Box sx={gridSx}>
        <AddressFields
          value={values.address}
          onChange={(address) => onChange({ address })}
          isoCountry
          fields={['street', 'postalCode', 'city', 'provinceState', 'country']}
          wide={['street']}
          optional={['street', 'postalCode', 'provinceState']}
          errors={{ street: errors.street, city: errors.city, country: errors.country }}
          countryHelperText={countryHint}
          disabled={disabled}
        />
      </Box>

      <FormSectionHeading icon={<MapOutlinedIcon />} title="Map and notes" />
      <Box sx={gridSx}>
        {mapInput}
        <Input
          label="Location notes (optional)"
          placeholder="Enter via the school gate"
          value={values.locationNotes}
          onChange={(event) => onChange({ locationNotes: event.target.value })}
          error={Boolean(errors.locationNotes)}
          helperText={errors.locationNotes}
          disabled={disabled}
          inputProps={{ maxLength: MAX_NOTES_LENGTH }}
          InputLabelProps={{ shrink: true }}
        />
      </Box>
    </Box>
  )
}
