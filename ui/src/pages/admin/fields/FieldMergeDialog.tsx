import { useEffect, useState } from 'react'
import { Alert, Autocomplete, Box, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Link, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Input } from '../../../components/Input'
import { listPlatformPlayingAreas, mergePlayingArea, PLATFORM_FIELDS_KEY } from '../../../api/platformPlayingAreaApi'
import type { PlatformPlayingArea } from '../../../api/platformPlayingAreaApi'
import type { PlayingArea } from '../../../api/playingAreaApi'
import { countryName } from '../../../utils/countries'
import { FIELD_STATUS_LABEL, fieldStatusOf } from '../../../utils/fieldStatus'
import { FIELD_CATEGORY_LABEL } from '../../../utils/fieldLabels'
import { NOT_ON_FILE } from '../../../utils/playerFormat'
import { errorDetail } from '../../../utils/errorDetail'

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_SIZE = 10

export interface FieldMergeDialogProps {
  open: boolean
  onClose: () => void
  // The duplicate that goes away.
  source: PlatformPlayingArea
  onMerged: (target: PlayingArea) => void
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

const sameText = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

function addressLine(field: PlayingArea): string {
  const { street, city, provinceState, postalCode, country } = field.address
  return [street, city, provinceState, postalCode, countryName(country)].filter(Boolean).join(', ')
}

function clubCount(field: PlayingArea): number {
  return field.linkedClubs?.length ?? field.linkedClubCount ?? 0
}

// One side of the comparison: everything an admin needs to tell two fields apart, so the wrong one is not picked.
function FieldFacts({ heading, tone, field }: { heading: string; tone: 'goes' | 'stays'; field: PlayingArea }) {
  const rows: [string, string | null][] = [
    ['Type', FIELD_CATEGORY_LABEL[field.category]],
    ['Owner', field.ownerName || null],
    ['Address', addressLine(field) || null],
    ['Status', FIELD_STATUS_LABEL[fieldStatusOf(field)]],
    ['Used by', `${plural(field.matchCount ?? 0, 'match', 'matches')}, ${plural(clubCount(field), 'club', 'clubs')}`],
  ]
  return (
    <Box
      data-testid={`merge-facts-${tone}`}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}
    >
      <Chip
        size="small"
        label={heading}
        color={tone === 'goes' ? 'error' : 'success'}
        variant="outlined"
        sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
      />
      <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
        {field.name}
      </Typography>
      {rows.map(([label, value]) => (
        <Box key={label} sx={{ display: 'flex', gap: 1, fontSize: '0.8125rem', minWidth: 0 }}>
          <Box component="span" sx={{ color: 'text.secondary', width: 56, flex: 'none' }}>
            {label}
          </Box>
          <Box component="span" sx={{ fontWeight: value ? 600 : 400, color: value ? 'text.primary' : 'text.secondary', overflowWrap: 'anywhere' }}>
            {value || NOT_ON_FILE}
          </Box>
        </Box>
      ))}
      {field.mapUrl && (
        <Link href={field.mapUrl} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
          Open in maps
        </Link>
      )}
    </Box>
  )
}

// Both sides next to each other, with a warning when they are not in the same town and country.
function FieldComparison({ source, target }: { source: PlayingArea; target: PlayingArea }) {
  const differentPlace = !sameText(source.address.city, target.address.city) || !sameText(source.address.country, target.address.country)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <FieldFacts heading="Goes away" tone="goes" field={source} />
        <FieldFacts heading="Stays" tone="stays" field={target} />
      </Box>
      {differentPlace && (
        <Alert severity="warning" data-testid="merge-different-place">
          These fields are in different places ({[source.address.city, countryName(source.address.country)].filter(Boolean).join(', ')} and{' '}
          {[target.address.city, countryName(target.address.country)].filter(Boolean).join(', ')}). Check you have picked the right one.
        </Alert>
      )}
    </Box>
  )
}

// docs/specs/099-fields-directory.md (9): "Merge into..." on the platform admin's field page. A search picker for the field
// that stays (verified and unverified ones; a rejected or merged one cannot be a target), then an explicit confirmation
// that says how many matches and clubs will move. Nothing merges until that confirm (feedback_import_always_confirm).
export function FieldMergeDialog({ open, onClose, source, onMerged }: FieldMergeDialogProps) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [target, setTarget] = useState<PlayingArea | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setTarget(null)
      setConfirming(false)
    }
  }, [open])

  // The queue endpoint lists one verification state at a time, so look in both that can be merged into.
  const { data: candidates, isFetching } = useQuery({
    queryKey: [...PLATFORM_FIELDS_KEY, 'merge-search', debouncedQuery],
    queryFn: async () => {
      const [verified, unverified] = await Promise.all([
        listPlatformPlayingAreas({ verification: 'VERIFIED', q: debouncedQuery || undefined, size: SEARCH_SIZE }),
        listPlatformPlayingAreas({ verification: 'UNVERIFIED', q: debouncedQuery || undefined, size: SEARCH_SIZE }),
      ])
      return [...verified.content, ...unverified.content]
    },
    enabled: open,
  })
  const options = (candidates ?? []).filter((candidate) => candidate.id !== source.id)

  const merge = useMutation({
    mutationFn: (chosen: PlayingArea) => mergePlayingArea(source.id, chosen.id).then(() => chosen),
    onSuccess: (chosen) => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_FIELDS_KEY })
      setConfirming(false)
      onMerged(chosen)
    },
  })

  const matches = source.matchCount ?? 0
  const clubs = source.linkedClubs?.length ?? source.linkedClubCount ?? 0

  return (
    <>
      <Dialog open={open && !confirming} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>Merge into another field</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Choose the field to keep. <b>{source.name}</b> is hidden and its matches and clubs move to the field you pick.
          </DialogContentText>
          <Autocomplete<PlayingArea>
            options={options}
            loading={isFetching}
            value={target}
            onChange={(_event, next) => setTarget(next)}
            inputValue={query}
            onInputChange={(_event, next, reason) => {
              if (reason === 'input' || reason === 'clear') setQuery(next)
            }}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, selected) => option.id === selected.id}
            filterOptions={(all) => all}
            renderOption={(props, option) => {
              const { key, ...rest } = props as typeof props & { key: string }
              return (
                <Box component="li" key={key} {...rest} sx={{ display: 'block !important' }}>
                  <Typography variant="body2">{option.name}</Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {[option.address.city, option.address.provinceState, countryName(option.address.country)].filter(Boolean).join(', ')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {[FIELD_CATEGORY_LABEL[option.category], option.ownerName, FIELD_STATUS_LABEL[fieldStatusOf(option)]].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
              )
            }}
            renderInput={(params) => (
              <Input
                {...params}
                label="Field to keep"
                placeholder="Search by field name or city"
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
          {target && <FieldComparison source={source} target={target} />}
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!target} onClick={() => setConfirming(true)}>
            Merge…
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={open && confirming}
        title="Merge these fields?"
        description={
          <>
            <Typography variant="body2" component="p" sx={{ mb: 1 }}>
              Merge <b>{source.name}</b> into <b>{target?.name}</b>?
            </Typography>
            {target && <FieldComparison source={source} target={target} />}
            <Typography variant="body2" component="p" color="text.secondary">
              {plural(matches, 'match', 'matches')} and {plural(clubs, 'club', 'clubs')} will move to {target?.name}. The old record is hidden. This cannot be undone.
            </Typography>
            {merge.isError && (
              <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                {errorDetail(merge.error, 'The fields could not be merged. Please try again.')}
              </Typography>
            )}
          </>
        }
        confirmLabel="Merge"
        pendingLabel="Merging…"
        destructive
        pending={merge.isPending}
        onConfirm={() => target && merge.mutate(target)}
        onClose={() => setConfirming(false)}
      />
    </>
  )
}
