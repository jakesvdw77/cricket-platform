import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Box, Popover, TextField, Typography } from '@mui/material'
import type { ImportCheckSettingsState } from '../../../components/ImportWizard'
import { Button } from '../../../components/Button'
import { DEFAULT_WINDOW_DAYS, MAX_WINDOW_DAYS, MIN_WINDOW_DAYS } from '../../../utils/leagueScheduleImport'

// docs/specs/098-league-schedule-import.md, "Match identity": windowDays (1 to 60, default 14) is the distance in days within which
// the same two teams meeting again is flagged as a possible duplicate. It lives in the batch's decisions.options, so it is restored on
// reload; Apply is one decisions save and the server rechecks every row.
function currentWindowDays(decisions: ImportCheckSettingsState['decisions']): number {
  const value = Number(decisions.options?.windowDays)
  return Number.isInteger(value) && value >= MIN_WINDOW_DAYS && value <= MAX_WINDOW_DAYS ? value : DEFAULT_WINDOW_DAYS
}

export function PossibleDuplicatesControl({ decisions, setOptions, disabled }: ImportCheckSettingsState) {
  const current = currentWindowDays(decisions)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [raw, setRaw] = useState(String(current))
  const days = Number(raw)
  const invalid = raw.trim() === '' || !Number.isInteger(days) || days < MIN_WINDOW_DAYS || days > MAX_WINDOW_DAYS

  const open = (event: MouseEvent<HTMLElement>) => {
    setRaw(String(current))
    setAnchor(event.currentTarget)
  }
  const close = () => setAnchor(null)
  const apply = () => {
    if (invalid) return
    close()
    if (days !== current) setOptions({ windowDays: days })
  }
  const touch = { minHeight: { xs: 44, md: 32 } }

  return (
    <>
      <Button size="compact" variant="secondary" disabled={disabled} aria-haspopup="dialog" aria-expanded={Boolean(anchor)} onClick={open} sx={{ ...touch, width: { xs: '100%', md: 'auto' } }}>
        {`Possible duplicates: within ${current} days`}
      </Button>
      <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={close} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Box component="form" noValidate onSubmit={(event) => { event.preventDefault(); apply() }} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, maxWidth: 340 }}>
          <Typography variant="body2" color="text.secondary">
            A match between the same two teams within this many days of a row is flagged as a possible duplicate. This also catches a rescheduled fixture.
          </Typography>
          <TextField
            size="small"
            type="number"
            label="Days"
            autoFocus
            value={raw}
            error={invalid}
            helperText={invalid ? `Enter a number from ${MIN_WINDOW_DAYS} to ${MAX_WINDOW_DAYS}` : undefined}
            inputProps={{ min: MIN_WINDOW_DAYS, max: MAX_WINDOW_DAYS, step: 1 }}
            onChange={(event) => setRaw(event.target.value)}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="compact" variant="ghost" onClick={close} sx={touch}>Cancel</Button>
            <Button size="compact" type="submit" disabled={invalid} sx={touch}>Apply</Button>
          </Box>
        </Box>
      </Popover>
    </>
  )
}
