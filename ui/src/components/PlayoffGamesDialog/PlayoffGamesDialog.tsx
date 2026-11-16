import { useMemo, useState } from 'react'
import { Alert, Autocomplete, Box, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, ListSubheader, MenuItem, Stack, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useQueryClient } from '@tanstack/react-query'
import { createPlayoffs, previewPlayoffs } from '../../api/playoffApi'
import type { PlayoffGame, PlayoffRound, PlayoffSide } from '../../api/playoffApi'
import type { Match } from '../../api/matchApi'
import type { Team } from '../../api/teamApi'
import type { LeagueTeam } from '../../api/leagueTeamApi'
import { errorDetail } from '../../utils/errorDetail'
import { fromDatetimeLocal } from '../../utils/datetimeLocal'
import { STAGE_SUGGESTIONS, stageOf, tbcText } from '../../utils/matchStages'
import { Button } from '../Button'
import { DateTimeField } from '../DateTimeField'
import { FieldPicker } from '../FieldPicker'
import { Input } from '../Input'
import { emptyRow, pairingRows, semiFinalRows } from './playoffPresets'
import type { PlayoffRow, PlayoffSideValue } from './playoffPresets'

export interface PlayoffGamesDialogProps {
  open: boolean
  onClose: () => void
  clubId: string
  leagueId: string
  seasonId: string
  // Our teams entered in the league this season, and the league's other (active) teams: the real sides a game can name.
  ownTeams: Team[]
  leagueTeams: LeagueTeam[]
  // Called after the games are created, so the schedule can reload.
  onCreated?: (created: Match[]) => void
  minDate?: string
  maxDate?: string
}

const TBC = 'tbc'
const OUR = 'team:'
const LEAGUE = 'lt:'

const choiceOf = (side: PlayoffSideValue): string => (side.kind === 'team' ? `${OUR}${side.id}` : side.kind === 'leagueTeam' ? `${LEAGUE}${side.id}` : TBC)

// The side a row sends: a TBC text, one of our teams, or a league team (docs/specs/155).
function toSide(side: PlayoffSideValue): PlayoffSide {
  return side.kind === 'tbc' ? { placeholder: side.text.trim() } : side.kind === 'team' ? { teamId: side.id } : { leagueTeamId: side.id }
}

// docs/specs/155: Add Playoff Games. Step one is a table of games (stage, label, both sides, when, where) filled by hand or by a preset;
// Review asks the server to check the whole round without writing; the confirm step lists what will be created and only Create Games writes.
export function PlayoffGamesDialog({ open, onClose, clubId, leagueId, seasonId, ownTeams, leagueTeams, onCreated, minDate, maxDate }: PlayoffGamesDialogProps) {
  const queryClient = useQueryClient()
  const [stage, setStage] = useState('Playoff')
  const [rows, setRows] = useState<PlayoffRow[]>(() => [emptyRow()])
  const [step, setStep] = useState<'edit' | 'confirm'>('edit')
  const [reviewed, setReviewed] = useState<Match[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const teamCount = ownTeams.length + leagueTeams.length
  const update = (key: string, patch: Partial<PlayoffRow>) => setRows((previous) => previous.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  // Every row needs a stage (its own or the round's), a date and a TBC text on each TBC side.
  const problem = useMemo(() => {
    if (rows.length === 0) return 'Add at least one game.'
    for (const row of rows) {
      if (!(row.stage.trim() || stage.trim())) return 'Every game needs a stage.'
      if (!row.matchDate) return 'Every game needs a date and time.'
      if ((row.home.kind === 'tbc' && !row.home.text.trim()) || (row.away.kind === 'tbc' && !row.away.text.trim())) return 'Every TBC side needs its text, for example 1st in the pool.'
      if (row.home.kind !== 'tbc' && row.home.kind === row.away.kind && row.home.id === row.away.id) return 'A team cannot play itself.'
    }
    return null
  }, [rows, stage])

  const round = (): PlayoffRound => ({
    stage: stage.trim() || rows[0]?.stage.trim() || 'Playoff',
    games: rows.map<PlayoffGame>((row) => ({
      stage: row.stage.trim() || null,
      label: row.label.trim() || null,
      home: toSide(row.home),
      away: toSide(row.away),
      matchDate: fromDatetimeLocal(row.matchDate),
      playingAreaId: row.field?.id ?? null,
      venue: row.field?.name ?? null,
    })),
  })

  const review = async () => {
    setBusy(true)
    setError(null)
    try {
      setReviewed(await previewPlayoffs(clubId, leagueId, seasonId, round()))
      setStep('confirm')
    } catch (failure) {
      setError(errorDetail(failure, 'The playoff games could not be checked. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const created = await createPlayoffs(clubId, leagueId, seasonId, round())
      await queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'leagues', leagueId, 'matches'] })
      await queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
      onCreated?.(created)
      onClose()
    } catch (failure) {
      setError(errorDetail(failure, 'The playoff games could not be created. Try again.'))
      setStep('edit')
    } finally {
      setBusy(false)
    }
  }

  const sideSelect = (label: string, side: PlayoffSideValue, onChange: (next: PlayoffSideValue) => void) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      <Input
        select
        label={label}
        value={choiceOf(side)}
        onChange={(event) => {
          const picked = event.target.value
          if (picked === TBC) onChange({ kind: 'tbc', text: side.kind === 'tbc' ? side.text : '', id: '' })
          else if (picked.startsWith(OUR)) onChange({ kind: 'team', text: '', id: picked.slice(OUR.length) })
          else onChange({ kind: 'leagueTeam', text: '', id: picked.slice(LEAGUE.length) })
        }}
      >
        <MenuItem value={TBC}>TBC (Not Known Yet)</MenuItem>
        {ownTeams.length > 0 && <ListSubheader>Our teams</ListSubheader>}
        {ownTeams.map((team) => (
          <MenuItem key={team.id} value={`${OUR}${team.id}`}>
            {team.name}
          </MenuItem>
        ))}
        {leagueTeams.length > 0 && <ListSubheader>League teams</ListSubheader>}
        {leagueTeams.map((team) => (
          <MenuItem key={team.id} value={`${LEAGUE}${team.id}`}>
            {team.name}
          </MenuItem>
        ))}
      </Input>
      {side.kind === 'tbc' && (
        <Input label="Shown As" placeholder="e.g. 1st in the pool" helperText="Text shown until the team is known" value={side.text} onChange={(event) => onChange({ ...side, text: event.target.value })} inputProps={{ maxLength: 120 }} />
      )}
    </Box>
  )

  const sideName = (match: Match, side: 'home' | 'away') => {
    const placeholder = side === 'home' ? match.homePlaceholder : match.awayPlaceholder
    const name = side === 'home' ? match.homeTeamName : match.awayTeamName
    return placeholder ? tbcText(name) : (name ?? 'TBC')
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="playoff-games-title">
      <DialogTitle id="playoff-games-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}>
        <Box component="span">{step === 'edit' ? 'Add Playoff Games' : `Create ${reviewed.length} ${reviewed.length === 1 ? 'game' : 'games'}?`}</Box>
        <IconButton aria-label="Close" onClick={onClose} disabled={busy} sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {step === 'edit' ? (
          <>
            <Typography variant="body2" color="text.secondary">
              Add one game for each playoff match. The sides can stay TBC until the pool ends; pick the real teams later with Edit Match.
            </Typography>
            <Stack direction="column" spacing={1.5}>
              <Autocomplete
                freeSolo
                disableClearable
                options={[...STAGE_SUGGESTIONS]}
                value={stage}
                inputValue={stage}
                onInputChange={(_, next) => setStage(next)}
                fullWidth
                renderInput={(params) => <Input {...params} label="Stage For All Games" helperText="Pick one or type your own" inputProps={{ ...params.inputProps, maxLength: 60 }} />}
              />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
                <Button size="compact" variant="secondary" onClick={() => setRows(pairingRows(teamCount, stage.trim() || 'Playoff'))}>
                  Fill 1v2, 3v4...
                </Button>
                <Button size="compact" variant="secondary" onClick={() => setRows(semiFinalRows())}>
                  Fill Semi-finals And Final
                </Button>
              </Stack>
            </Stack>

            {rows.map((row, index) => (
              <Box key={row.key} data-testid="playoff-row" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">{`Game ${index + 1}`}</Typography>
                  <IconButton aria-label={`Remove game ${index + 1}`} onClick={() => setRows((previous) => previous.filter((candidate) => candidate.key !== row.key))} sx={{ width: 44, height: 44 }}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 480 }}>
                  {sideSelect('Home Side', row.home, (home) => update(row.key, { home }))}
                  {sideSelect('Away Side', row.away, (away) => update(row.key, { away }))}
                  <DateTimeField label="Date & time" value={row.matchDate} onChange={(matchDate) => update(row.key, { matchDate })} min={minDate} max={maxDate} />
                  <FieldPicker clubId={clubId} value={row.field} onChange={(field) => update(row.key, { field: field ? { id: field.id, name: field.name, verificationStatus: null } : null })} />
                  <Input label="Label" placeholder="e.g. 1st v 2nd" helperText="Shown on the schedule" value={row.label} onChange={(event) => update(row.key, { label: event.target.value })} inputProps={{ maxLength: 80 }} />
                  <Input label="Stage" placeholder={stage || 'Playoff'} helperText="Only if different" value={row.stage} onChange={(event) => update(row.key, { stage: event.target.value })} inputProps={{ maxLength: 60 }} />
                </Box>
              </Box>
            ))}
            <Box>
              <Button size="compact" variant="secondary" onClick={() => setRows((previous) => [...previous, emptyRow()])}>
                Add Game
              </Button>
            </Box>
            {problem && rows.some((row) => row.matchDate || row.home.text || row.label) && (
              <Typography variant="caption" color="warning.main">
                {problem}
              </Typography>
            )}
          </>
        ) : (
          <>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
              <Box component="tbody">
                {reviewed.map((match) => (
                  <Box component="tr" key={match.id} data-testid="playoff-review-row" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Box component="td" sx={{ py: 1, pr: 1, whiteSpace: 'nowrap' }}>
                      {new Date(match.matchDate).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Box>
                    <Box component="td" sx={{ py: 1, pr: 1 }}>
                      {`${sideName(match, 'home')} v ${sideName(match, 'away')}`}
                    </Box>
                    <Box component="td" sx={{ py: 1, pr: 1 }}>
                      {match.venue ?? <Chip size="small" label="No Field" />}
                    </Box>
                    <Box component="td" sx={{ py: 1 }}>
                      {stageOf(match) && <Chip size="small" variant="outlined" color="primary" label={stageOf(match)} />}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Nothing has been created yet. The league log will not count these games. Pick the real teams later with Edit Match once the pool ends.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ gap: 1, px: 3, py: 1.5 }}>
        {step === 'edit' ? (
          <>
            <Button size="compact" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button size="compact" onClick={review} disabled={busy || Boolean(problem)}>
              Review
            </Button>
          </>
        ) : (
          <>
            <Button size="compact" variant="secondary" onClick={() => setStep('edit')} disabled={busy}>
              Back
            </Button>
            <Button size="compact" onClick={create} disabled={busy}>
              {`Create ${reviewed.length} ${reviewed.length === 1 ? 'Game' : 'Games'}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
