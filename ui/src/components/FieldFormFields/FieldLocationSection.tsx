import { useState } from 'react'
import { Box, Collapse, Typography } from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined'
import { Button } from '../Button'
import { ConfirmDialog } from '../ConfirmDialog'
import { FormSectionHeading } from '../FormSectionHeading'
import { Input } from '../Input'
import { searchPlaces } from '../../api/weatherApi'
import type { PlaceMatch } from '../../api/weatherApi'
import { coordinateText, MAX_ACCESS_NOTE_LENGTH } from '../../utils/fieldForm'
import type { FieldFormErrors, FieldFormValues } from '../../utils/fieldForm'
import { isShortMapLink, parseMapCoords, placeFromAddress } from '../../utils/weather/mapCoords'

export const SHORT_LINK_MESSAGE = 'This short link cannot be read. Type the coordinates, or use Find On Map.'
export const NO_POSITION_MESSAGE = 'No position found in this link. Type the coordinates, or use Find On Map.'
export const READ_FROM_LINK_MESSAGE = 'Read from the map link'
export const APPROXIMATE_MESSAGE = 'Town centre only: approximate. Move the pin by typing the coordinates if you know them.'

export interface FieldLocationSectionProps {
  values: FieldFormValues
  onChange: (patch: Partial<FieldFormValues>) => void
  errors: FieldFormErrors
  disabled: boolean
  compact: boolean
  // The grid the surrounding form uses, so the section lines up with the others.
  gridSx: object
}

const hasPosition = (values: FieldFormValues): boolean => values.latitude.trim() !== '' || values.longitude.trim() !== ''

const placeLabel = (place: PlaceMatch): string => [place.name, place.admin1, place.country].filter(Boolean).join(', ')

// docs/specs/133 (Field form): the Location section (latitude, longitude, Read From Map Link, Find On Map) and the collapsed
// Entrance Or Parking section. Pasting a map link never changes these values; they change only when the manager presses Read From
// Map Link (after a confirm when they differ) or picks a Find On Map result.
export function FieldLocationSection({ values, onChange, errors, disabled, compact, gridSx }: FieldLocationSectionProps) {
  const [status, setStatus] = useState<{ text: string; tone: 'info' | 'error' } | null>(null)
  const [pendingRead, setPendingRead] = useState<{ lat: number; lng: number } | null>(null)
  const [matches, setMatches] = useState<PlaceMatch[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [accessOpen, setAccessOpen] = useState(() => values.accessLatitude !== '' || values.accessLongitude !== '' || values.accessNote !== '')

  const apply = (lat: number, lng: number) => onChange({ latitude: coordinateText(lat), longitude: coordinateText(lng) })

  const readFromLink = () => {
    setMatches(null)
    const found = parseMapCoords(values.mapUrl)
    if (!found) {
      setStatus({ text: isShortMapLink(values.mapUrl) ? SHORT_LINK_MESSAGE : NO_POSITION_MESSAGE, tone: 'error' })
      return
    }
    const same = Number(values.latitude) === found.lat && Number(values.longitude) === found.lng
    if (hasPosition(values) && !same) {
      setPendingRead(found)
      return
    }
    apply(found.lat, found.lng)
    setStatus({ text: READ_FROM_LINK_MESSAGE, tone: 'info' })
  }

  const place = placeFromAddress(values.address)
  const findOnMap = async () => {
    if (!place) return
    setStatus(null)
    setSearching(true)
    try {
      const found = await searchPlaces(place)
      setMatches(found)
      if (found.length === 0) setStatus({ text: 'No town matched. Check the city and country, or type the coordinates.', tone: 'error' })
    } catch {
      setMatches(null)
      setStatus({ text: 'The map lookup is not available right now. Type the coordinates instead.', tone: 'error' })
    } finally {
      setSearching(false)
    }
  }

  const pick = (match: PlaceMatch) => {
    apply(match.coords.lat, match.coords.lng)
    setMatches(null)
    setStatus({ text: APPROXIMATE_MESSAGE, tone: 'info' })
  }

  return (
    <>
      <FormSectionHeading compact={compact} icon={<ExploreOutlinedIcon />} title="Location" />
      <Box sx={gridSx}>
        <Input
          label="Latitude (optional)"
          placeholder="-26.1234"
          value={values.latitude}
          onChange={(event) => onChange({ latitude: event.target.value })}
          error={Boolean(errors.latitude)}
          helperText={errors.latitude}
          disabled={disabled}
          inputProps={{ inputMode: 'decimal', maxLength: 12 }}
          InputLabelProps={{ shrink: true }}
        />
        <Input
          label="Longitude (optional)"
          placeholder="28.0456"
          value={values.longitude}
          onChange={(event) => onChange({ longitude: event.target.value })}
          error={Boolean(errors.longitude)}
          helperText={errors.longitude}
          disabled={disabled}
          inputProps={{ inputMode: 'decimal', maxLength: 12 }}
          InputLabelProps={{ shrink: true }}
        />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', minHeight: 36 }}>
          <Button size="compact" variant="secondary" onClick={readFromLink} disabled={disabled || !values.mapUrl.trim()}>
            Read From Map Link
          </Button>
          <Button size="compact" variant="secondary" onClick={() => void findOnMap()} disabled={disabled || !place || searching}>
            {searching ? 'Searching…' : 'Find On Map'}
          </Button>
        </Box>
        {status && (
          <Typography role="status" variant="caption" color={status.tone === 'error' ? 'error.main' : 'text.secondary'} sx={{ gridColumn: '1 / -1' }}>
            {status.text}
          </Typography>
        )}
        {matches && matches.length > 0 && (
          <Box role="region" aria-label="Towns that match" sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography variant="caption" color="text.secondary">
              Choose the town. This is the town centre, so it is approximate.
            </Typography>
            {matches.map((match) => (
              <Box
                key={`${match.coords.lat},${match.coords.lng}`}
                data-testid="town-match"
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.75 }}
              >
                <Typography variant="body2">{placeLabel(match)}</Typography>
                <Button size="compact" variant="secondary" onClick={() => pick(match)} aria-label={`Use ${placeLabel(match)}`}>
                  Use This Town
                </Button>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Box>
        <Button
          size="compact"
          variant="ghost"
          onClick={() => setAccessOpen((open) => !open)}
          aria-expanded={accessOpen}
          aria-controls="field-access-point"
          startIcon={accessOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        >
          Entrance Or Parking
        </Button>
      </Box>
      <Collapse in={accessOpen} unmountOnExit={false}>
        <Box id="field-access-point" sx={gridSx}>
          <Input
            label="Access latitude (optional)"
            placeholder="-26.1240"
            value={values.accessLatitude}
            onChange={(event) => onChange({ accessLatitude: event.target.value })}
            error={Boolean(errors.accessLatitude)}
            helperText={errors.accessLatitude}
            disabled={disabled}
            inputProps={{ inputMode: 'decimal', maxLength: 12 }}
            InputLabelProps={{ shrink: true }}
          />
          <Input
            label="Access longitude (optional)"
            placeholder="28.0460"
            value={values.accessLongitude}
            onChange={(event) => onChange({ accessLongitude: event.target.value })}
            error={Boolean(errors.accessLongitude)}
            helperText={errors.accessLongitude}
            disabled={disabled}
            inputProps={{ inputMode: 'decimal', maxLength: 12 }}
            InputLabelProps={{ shrink: true }}
          />
          <Input
            label="Access note (optional)"
            placeholder="Use gate 2 off Main Rd"
            value={values.accessNote}
            onChange={(event) => onChange({ accessNote: event.target.value })}
            error={Boolean(errors.accessNote)}
            helperText={errors.accessNote}
            disabled={disabled}
            inputProps={{ maxLength: MAX_ACCESS_NOTE_LENGTH }}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </Collapse>

      <ConfirmDialog
        open={pendingRead !== null}
        title="Replace Coordinates"
        description="Replace latitude and longitude with the ones in the link?"
        confirmLabel="Replace"
        onClose={() => setPendingRead(null)}
        onConfirm={() => {
          if (pendingRead) {
            apply(pendingRead.lat, pendingRead.lng)
            setStatus({ text: READ_FROM_LINK_MESSAGE, tone: 'info' })
          }
          setPendingRead(null)
        }}
      />
    </>
  )
}
