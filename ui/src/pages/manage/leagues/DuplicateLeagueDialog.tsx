import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Alert,
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { isAxiosError } from 'axios'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import type { Season } from '../../../api/seasonApi'
import { errorDetail } from '../../../utils/errorDetail'
import { duplicateLeagueNotice } from './duplicateLeagueNotice'
import { useDuplicateLeague } from './useDuplicateLeague'

export interface DuplicateLeagueDialogProps {
  open: boolean
  clubId: string
  // The league being duplicated.
  league: { id: string; name: string }
  // Every season of the club, already loaded by both mount points.
  seasons: Season[]
  // The season the page is showing; the only season ticked to start (when it is one of the club's).
  defaultSeasonId: string
  onClose: () => void
}

const NAME_MAX = 255

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const optionRowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  minHeight: 44,
  cursor: 'pointer',
} as const

// docs/specs/096-duplicate-league.md: creates a new league with the same setup. Mounted only while open (so state resets),
// full-screen on a phone. Owns its mutation and navigates to the new league's Teams tab on success. Nothing is sent
// until Duplicate league is clicked.
export function DuplicateLeagueDialog({ open, clubId, league, seasons, defaultSeasonId, onClose }: DuplicateLeagueDialogProps) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const navigate = useNavigate()
  const duplicate = useDuplicateLeague(clubId)

  const sortedSeasons = useMemo(() => [...seasons].sort((a, b) => b.startDate.localeCompare(a.startDate)), [seasons])
  const hasSeasons = sortedSeasons.length > 0

  const [name, setName] = useState(`${league.name} (copy)`)
  const [copyConditions, setCopyConditions] = useState(hasSeasons)
  const [copyContacts, setCopyContacts] = useState(true)
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(sortedSeasons.some((season) => season.id === defaultSeasonId) ? [defaultSeasonId] : []),
  )

  const trimmed = name.trim()
  const tooLong = trimmed.length > NAME_MAX
  const needsSeason = copyConditions && chosen.size === 0
  const pending = duplicate.isPending
  const canSubmit = trimmed.length > 0 && !tooLong && !needsSeason && !pending

  const conflict = isAxiosError(duplicate.error) && duplicate.error.response?.status === 409
  const nameError = tooLong
    ? `Keep the name to ${NAME_MAX} characters or fewer`
    : conflict
      ? errorDetail(duplicate.error, `A league named ${trimmed} already exists`)
      : undefined
  const otherError =
    duplicate.isError && !conflict
      ? errorDetail(duplicate.error, 'Something went wrong duplicating this league. Please try again.')
      : null

  const toggleSeason = (id: string) =>
    setChosen((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      return
    }
    // Display order (newest first) is kept in the request.
    const seasonIds = copyConditions ? sortedSeasons.filter((season) => chosen.has(season.id)).map((season) => season.id) : []
    duplicate.mutate(
      {
        leagueId: league.id,
        request: { name: trimmed, seasonIds, copyPlayingConditions: copyConditions, copyContacts },
      },
      {
        onSuccess: (response) => {
          const seasonId = seasonIds[0] ?? defaultSeasonId
          const search = `?tab=teams${seasonId ? `&seasonId=${seasonId}` : ''}`
          onClose()
          navigate(`/manage/fixtures/leagues/${response.leagueId}/edit${search}`, {
            state: { notice: duplicateLeagueNotice(response) },
          })
        },
      },
    )
  }

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle sx={{ pb: 0.5 }}>Duplicate league</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Creates a new league with the same setup. Its teams and matches start empty, so you can add them next.
          </Typography>
          <Stack spacing={2}>
            <Input
              label="New league name"
              required
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                if (duplicate.isError) {
                  duplicate.reset()
                }
              }}
              onFocus={(event) => event.target.select()}
              error={Boolean(nameError)}
              helperText={nameError}
              sx={{ mt: 1 }}
            />

            <Box role="group" aria-label="What to copy">
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                What to copy
              </Typography>
              <Box component="label" sx={optionRowSx}>
                <Checkbox
                  checked={copyConditions}
                  disabled={!hasSeasons}
                  onChange={(event) => setCopyConditions(event.target.checked)}
                  inputProps={{ 'aria-label': 'Copy playing conditions' }}
                />
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Copy playing conditions
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Match format, points and bonus rules, and the conditions PDF
                  </Typography>
                </Box>
              </Box>

              {copyConditions && (
                <Box sx={{ pl: { xs: 0, sm: 4 }, pb: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
                      Seasons to copy them for
                    </Typography>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={chosen.size === sortedSeasons.length}
                      onClick={() => setChosen(new Set(sortedSeasons.map((season) => season.id)))}
                    >
                      Select all
                    </Button>
                    <Button variant="ghost" size="sm" disabled={chosen.size === 0} onClick={() => setChosen(new Set())}>
                      Select none
                    </Button>
                  </Stack>
                  <Box
                    role="group"
                    aria-label="Seasons to copy"
                    sx={{ border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 240, overflow: 'auto' }}
                  >
                    {sortedSeasons.map((season) => (
                      <Box
                        key={season.id}
                        component="label"
                        sx={{ ...optionRowSx, px: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                      >
                        <Checkbox
                          checked={chosen.has(season.id)}
                          onChange={() => toggleSeason(season.id)}
                          inputProps={{ 'aria-label': season.label }}
                        />
                        <Typography variant="body2" fontWeight={600} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                          {season.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', pl: 1 }}>
                          {formatDate(season.startDate)} to {formatDate(season.endDate)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  {needsSeason && (
                    <Typography variant="caption" color="error" role="status" sx={{ display: 'block', mt: 0.5 }}>
                      Choose at least one season, or untick Copy playing conditions
                    </Typography>
                  )}
                </Box>
              )}
              {!hasSeasons && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: { sm: 4 }, pb: 1 }}>
                  This club has no seasons yet, so there are no playing conditions to copy.
                </Typography>
              )}

              <Box component="label" sx={optionRowSx}>
                <Checkbox
                  checked={copyContacts}
                  onChange={(event) => setCopyContacts(event.target.checked)}
                  inputProps={{ 'aria-label': 'Copy contacts' }}
                />
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Copy contacts
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active league contacts
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                Always copied: format, playing XI size, age rules and cutoff date, logo, phone, email, website and social links.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Not copied: the club&apos;s team entries, opponent teams, matches and results. Add this league&apos;s teams on its Teams
                tab.
              </Typography>
            </Stack>

            {otherError && <Alert severity="error">{otherError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {pending ? 'Duplicating…' : 'Duplicate league'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
