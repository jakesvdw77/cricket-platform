import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Box, Button as MuiButton, Checkbox, FormControlLabel, Popover, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import TuneIcon from '@mui/icons-material/Tune'
import { BottomSheet } from '../../../components/BottomSheet'
import type { LeaderboardBoardInfo } from '../../../api/leaderboardApi'
import { useLeaderboardSettings, useSaveLeaderboardSettings } from '../../../api/leaderboardSettingsApi'

const humanise = (code: string) => code.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

interface ChooserFormProps {
  clubId: string
  catalogue: LeaderboardBoardInfo[]
  onDone: () => void
}

// The checkbox list: "Shown by default" then "Also available", saved for the whole club with Save for club.
function ChooserForm({ clubId, catalogue, onDone }: ChooserFormProps) {
  const settingsQuery = useLeaderboardSettings(clubId)
  const save = useSaveLeaderboardSettings(clubId)
  const settings = settingsQuery.data
  // The ticked codes: undefined until the person changes something, so the form always starts from what is saved.
  const [edited, setEdited] = useState<string[] | undefined>(undefined)
  const selected = edited ?? settings?.awardCategories ?? []

  const labels = new Map(catalogue.map((board) => [board.code, board.label]))
  const labelFor = (code: string) => labels.get(code) ?? humanise(code)
  // The nine headline categories are the catalogue's awardDefault boards; everything else selectable is "Also available".
  const defaults = catalogue.filter((board) => board.awardDefault).map((board) => board.code)
  const selectable = settings?.selectableCategories ?? []
  const extras = selectable.filter((code) => !defaults.includes(code))

  const toggle = (code: string) =>
    setEdited(selected.includes(code) ? selected.filter((existing) => existing !== code) : [...selected, code])

  const group = (title: string, codes: string[]) =>
    codes.length === 0 ? null : (
      <Box component="fieldset" sx={{ border: 0, m: 0, p: 0 }}>
        <Typography component="legend" sx={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.secondary', mb: 0.5 }}>
          {title}
        </Typography>
        {codes.map((code) => (
          <FormControlLabel
            key={code}
            sx={{ display: 'flex', minHeight: 44, mx: 0, '& .MuiFormControlLabel-label': { fontSize: '1rem' } }}
            control={<Checkbox checked={selected.includes(code)} onChange={() => toggle(code)} />}
            label={labelFor(code)}
          />
        ))}
      </Box>
    )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: { sm: 320 }, maxWidth: 380 }}>
      <Typography component="h3" sx={{ fontSize: '1.0625rem', fontWeight: 700 }}>
        Choose categories
      </Typography>
      <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>These are saved for the whole club, so every manager sees the same sheet.</Typography>
      {settingsQuery.isError ? (
        <Typography role="alert" sx={{ color: 'error.main', fontSize: '0.9375rem' }}>
          Could not load the categories.{' '}
          <MuiButton variant="text" onClick={() => settingsQuery.refetch()}>
            Try again
          </MuiButton>
        </Typography>
      ) : !settings ? (
        <Typography sx={{ fontSize: '0.9375rem', color: 'text.secondary' }}>Loading...</Typography>
      ) : (
        <>
          {group('Shown by default', defaults.filter((code) => selectable.includes(code)))}
          {group('Also available', extras)}
        </>
      )}
      {selected.length === 0 && settings && (
        <Typography role="status" sx={{ fontSize: '0.875rem', color: 'warning.dark' }}>
          Choose at least one category.
        </Typography>
      )}
      {save.isError && (
        <Typography role="alert" sx={{ fontSize: '0.875rem', color: 'error.main' }}>
          Could not save. Please try again.
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <MuiButton
          variant="contained"
          sx={{ flex: 1, minHeight: 44 }}
          disabled={!settings || selected.length === 0 || save.isPending}
          onClick={() => save.mutate(selected, { onSuccess: onDone })}
        >
          Save for club
        </MuiButton>
        <MuiButton variant="outlined" sx={{ minHeight: 44 }} onClick={onDone}>
          Cancel
        </MuiButton>
      </Box>
    </Box>
  )
}

export interface CategoryChooserProps {
  clubId: string
  catalogue: LeaderboardBoardInfo[]
}

// docs/specs/103-player-stats.md decision 11/18 and the Awards mockup: the "Choose categories" button. A popover on a desktop, a
// BottomSheet on a phone; the choice is saved for the club through the leaderboard-settings API.
export function CategoryChooser({ clubId, catalogue }: CategoryChooserProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const close = () => {
    setOpen(false)
    setAnchor(null)
  }

  return (
    <>
      <MuiButton
        variant="contained"
        startIcon={<TuneIcon />}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event: MouseEvent<HTMLElement>) => {
          setAnchor(event.currentTarget)
          setOpen(true)
        }}
        sx={{ minHeight: 44 }}
      >
        Choose categories
      </MuiButton>
      {phone ? (
        <BottomSheet open={open} onOpen={() => setOpen(true)} onClose={close} ariaLabel="Choose categories" closeLabel="Close">
          {open && <ChooserForm clubId={clubId} catalogue={catalogue} onDone={close} />}
        </BottomSheet>
      ) : (
        <Popover
          open={open}
          anchorEl={anchor}
          onClose={close}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { 'aria-label': 'Choose categories', sx: { p: 2, maxHeight: '80vh' } } }}
        >
          <ChooserForm clubId={clubId} catalogue={catalogue} onDone={close} />
        </Popover>
      )}
    </>
  )
}
