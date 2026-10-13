import { useEffect, useState } from 'react'
import { Autocomplete, Box, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Input } from '../../../components/Input'
import { listPlatformPlayingAreas, mergePlayingArea, PLATFORM_FIELDS_KEY } from '../../../api/platformPlayingAreaApi'
import type { PlatformPlayingArea } from '../../../api/platformPlayingAreaApi'
import type { PlayingArea } from '../../../api/playingAreaApi'
import { countryName } from '../../../utils/countries'
import { FIELD_STATUS_LABEL, fieldStatusOf } from '../../../utils/fieldStatus'
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
      <Dialog open={open && !confirming} onClose={onClose} fullWidth maxWidth="sm">
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
                  <Typography variant="caption" color="text.secondary">
                    {[option.address.city, countryName(option.address.country), FIELD_STATUS_LABEL[fieldStatusOf(option)]].filter(Boolean).join(' · ')}
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
