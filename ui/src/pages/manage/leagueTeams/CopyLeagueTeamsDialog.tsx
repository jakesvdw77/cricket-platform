import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { avatarSx } from '../../../components/RecordCard'
import { listLeagues } from '../../../api/leagueApi'
import { listSeasons } from '../../../api/seasonApi'
import { leagueTeamsQueryKey, listLeagueTeams } from '../../../api/leagueTeamApi'
import type { LeagueTeam } from '../../../api/leagueTeamApi'
import { initialsFromName } from '../../../utils/initials'

export interface CopyLeagueTeamsDialogProps {
  open: boolean
  clubId: string
  // Target league and season, plus its existing teams (to flag duplicates by name).
  leagueId: string
  seasonId: string
  contextLabel: string
  targetTeams: LeagueTeam[]
  pending: boolean
  errorMessage?: string | null
  onCopy: (source: { sourceLeagueId: string; sourceSeasonId: string; leagueTeamIds: string[] }) => void
  onClose: () => void
}

const nameKey = (name: string) => name.trim().toLowerCase()

// docs/specs/070-league-teams.md: pick any league and season of the club, tick the teams to bring
// across (all ticked to start; names already in the target are disabled), and confirm. Nothing is
// sent until Confirm. Full-screen on a phone. Mounted only while open.
export function CopyLeagueTeamsDialog({
  open,
  clubId,
  leagueId,
  seasonId,
  contextLabel,
  targetTeams,
  pending,
  errorMessage,
  onCopy,
  onClose,
}: CopyLeagueTeamsDialogProps) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

  const leaguesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues'],
    queryFn: () => listLeagues(clubId),
  })
  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId),
  })

  const [sourceLeagueId, setSourceLeagueId] = useState(leagueId)
  // '' = not chosen yet; the default (most recent other season) is applied once seasons load.
  const [sourceSeasonId, setSourceSeasonId] = useState('')
  const [deselected, setDeselected] = useState<Set<string>>(new Set())

  const seasons = seasonsQuery.data
  useEffect(() => {
    if (sourceSeasonId || !seasons) {
      return
    }
    const mostRecentOther = [...seasons]
      .filter((season) => season.id !== seasonId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
    if (mostRecentOther) {
      setSourceSeasonId(mostRecentOther.id)
    }
  }, [seasons, sourceSeasonId, seasonId])

  const sourceQuery = useQuery({
    queryKey: leagueTeamsQueryKey(clubId, sourceLeagueId, sourceSeasonId),
    queryFn: () => listLeagueTeams(clubId, sourceLeagueId, sourceSeasonId),
    enabled: Boolean(sourceLeagueId) && Boolean(sourceSeasonId),
  })

  const existingNames = useMemo(() => new Set(targetTeams.map((team) => nameKey(team.name))), [targetTeams])
  const rows = useMemo(
    () => (sourceQuery.data ?? []).map((team) => ({ team, duplicate: existingNames.has(nameKey(team.name)) })),
    [sourceQuery.data, existingNames],
  )
  const selectable = rows.filter((row) => !row.duplicate)
  const selectedIds = selectable.filter((row) => !deselected.has(row.team.id)).map((row) => row.team.id)
  const duplicateCount = rows.length - selectable.length

  const changeSource = (nextLeague: string, nextSeason: string) => {
    setSourceLeagueId(nextLeague)
    setSourceSeasonId(nextSeason)
    setDeselected(new Set())
  }

  const toggle = (id: string) =>
    setDeselected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  const count = selectedIds.length
  const allSelected = selectable.length > 0 && count === selectable.length

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 0.5 }}>Copy league teams</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Into {contextLabel}. Nothing is copied until you confirm.
        </Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
            <Input
              select
              label="From league"
              value={(leaguesQuery.data ?? []).some((league) => league.id === sourceLeagueId) ? sourceLeagueId : ''}
              onChange={(event) => changeSource(event.target.value, sourceSeasonId)}
            >
              {(leaguesQuery.data ?? []).map((league) => (
                <MenuItem key={league.id} value={league.id}>
                  {league.name}
                </MenuItem>
              ))}
            </Input>
            <Input
              select
              label="From season"
              value={(seasons ?? []).some((season) => season.id === sourceSeasonId) ? sourceSeasonId : ''}
              onChange={(event) => changeSource(sourceLeagueId, event.target.value)}
            >
              {(seasons ?? []).map((season) => (
                <MenuItem key={season.id} value={season.id}>
                  {season.label}
                </MenuItem>
              ))}
            </Input>
          </Stack>

          {!sourceSeasonId && (
            <Typography variant="body2" color="text.secondary">
              Choose a source season to see its teams.
            </Typography>
          )}
          {sourceSeasonId && sourceQuery.isError && (
            <Alert severity="error">Couldn&apos;t load that league&apos;s teams. Please try again.</Alert>
          )}
          {sourceSeasonId && sourceQuery.isSuccess && rows.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No league teams registered for that league and season.
            </Typography>
          )}

          {rows.length > 0 && (
            <>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={allSelected}
                  onClick={() => setDeselected(new Set())}
                >
                  Select all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={count === 0}
                  onClick={() => setDeselected(new Set(selectable.map((row) => row.team.id)))}
                >
                  Select none
                </Button>
              </Stack>
              <Box
                role="group"
                aria-label="Teams to copy"
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 300, overflow: 'auto' }}
              >
                {rows.map(({ team, duplicate }) => (
                  <Stack
                    key={team.id}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderBottom: 1,
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 0 },
                      ...(duplicate && { bgcolor: 'action.hover' }),
                    }}
                  >
                    <Checkbox
                      checked={!duplicate && !deselected.has(team.id)}
                      disabled={duplicate}
                      onChange={() => toggle(team.id)}
                      inputProps={{ 'aria-label': team.name }}
                    />
                    <Avatar src={team.logoUrl ?? undefined} variant="rounded" sx={avatarSx(32, '0.75rem')}>
                      {initialsFromName(team.abbreviation || team.name)}
                    </Avatar>
                    <Typography
                      variant="body2"
                      fontWeight={duplicate ? 400 : 600}
                      color={duplicate ? 'text.secondary' : 'text.primary'}
                      sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}
                    >
                      {team.name}
                    </Typography>
                    {duplicate ? (
                      <Chip size="small" variant="outlined" label="Already in this season" />
                    ) : (
                      team.abbreviation && (
                        <Typography variant="caption" color="text.secondary">
                          {team.abbreviation}
                        </Typography>
                      )
                    )}
                  </Stack>
                ))}
              </Box>
              <Stack direction="row" justifyContent="space-between" flexWrap="wrap" useFlexGap spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  {count} of {rows.length} selected
                </Typography>
                {duplicateCount > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {duplicateCount} already here, skipped
                  </Typography>
                )}
              </Stack>
            </>
          )}

          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          disabled={pending || count === 0}
          onClick={() => onCopy({ sourceLeagueId, sourceSeasonId, leagueTeamIds: selectedIds })}
        >
          {pending ? 'Copying…' : `Copy ${count} ${count === 1 ? 'team' : 'teams'}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
