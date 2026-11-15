import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, ToggleButton, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { useQuery } from '@tanstack/react-query'
import { listLeagues } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'
import { listSections } from '../../api/sectionApi'
import { listSquad } from '../../api/teamSquadApi'
import type { Match } from '../../api/matchApi'
import { generateTeamSheetPdf } from '../../utils/share/printableTeamSheetPdf'
import type { TeamSheetSpec } from '../../utils/share/printableTeamSheetPdf'
import { EMPTY_MATCH_INFO, matchInfoFor, sheetPages, sheetPlayers, teamMatches, teamSheetFileName } from '../../utils/teamSheet'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { Input } from '../Input'
import { ShareControlGroup, SharePdfActions } from '../ShareCore'
import { ShareFillContext, ShareFooterContext, ShareFormatScreen } from '../ShareFormatScreen'
import { TeamSheetPaperPreview } from './TeamSheetPaperPreview'

type Mode = 'blank' | 'one' | 'all'

export interface TeamSheetTeam {
  id: string
  name: string
  logoUrl: string | null
  sectionId: string | null
}

export interface TeamSheetDialogProps {
  open: boolean
  onClose: () => void
  clubId: string
  // The teams that can print: one on the Team page, our entered teams on the League page.
  teams: TeamSheetTeam[]
  seasonId: string
  seasonLabel: string | null
  // The season's matches; the dialog keeps the chosen team's own.
  matches: Match[]
  // League page only: keep this league's matches and use its logo.
  leagueId?: string | null
  initialMode?: Mode
  // Which match is chosen first in "One Match" (a match's own Print Team Sheet shortcut).
  initialMatchId?: string | null
  initialTeamId?: string | null
}

const when = (match: Match): string => {
  const date = new Date(match.matchDate)
  const day = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${day} ${time}`
}

// docs/specs/153-printable-team-sheet.md: print a blank team sheet, the sheet for one match, or one PDF with a page for every match of
// a team. The whole squad is listed alphabetically; Playing, Capt and Keeper are empty boxes unless Pre-Mark is on. Full names always
// (owner decision); nothing is stored.
export function TeamSheetDialog({ open, onClose, clubId, teams, seasonId, seasonLabel, matches, leagueId = null, initialMode = 'blank', initialMatchId = null, initialTeamId = null }: TeamSheetDialogProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const [footer, setFooter] = useState<HTMLElement | null>(null)
  const [teamId, setTeamId] = useState<string>(initialTeamId ?? teams[0]?.id ?? '')
  const [mode, setMode] = useState<Mode>(initialMode)
  const [matchId, setMatchId] = useState<string>(initialMatchId ?? '')
  const [unticked, setUnticked] = useState<Set<string>>(new Set())
  const [blankLeagueId, setBlankLeagueId] = useState<string>('')
  const [preMark, setPreMark] = useState(false)
  const team = teams.find((candidate) => candidate.id === teamId) ?? teams[0] ?? null

  const leagues = useQuery({ queryKey: ['managed-club', clubId, 'leagues', 'team-sheet'], queryFn: () => listLeagues(clubId), enabled: open && Boolean(clubId) })
  const squad = useQuery({
    queryKey: ['managed-club', clubId, 'teams', team?.id, 'seasons', seasonId, 'squad'],
    queryFn: () => listSquad(clubId, team?.id as string, seasonId),
    enabled: open && Boolean(clubId) && Boolean(team) && Boolean(seasonId),
  })
  const sections = useQuery({ queryKey: ['managed-club', clubId, 'sections'], queryFn: () => listSections(clubId), enabled: open && Boolean(clubId) })

  const leaguesById = useMemo(() => new Map<string, League>((leagues.data ?? []).map((league) => [league.id, league])), [leagues.data])
  const teamMatchList = useMemo(
    () => (team ? teamMatches(matches, team.id).filter((match) => !leagueId || match.leagueId === leagueId) : []),
    [matches, team, leagueId],
  )
  const players = useMemo(() => sheetPlayers(squad.data ?? []), [squad.data])

  // The leagues this team plays in this season, for the blank sheet's league logo.
  const teamLeagues = useMemo(() => {
    const ids = [...new Set(teamMatchList.map((match) => match.leagueId).filter((id): id is string => Boolean(id)))]
    return ids.map((id) => leaguesById.get(id)).filter((league): league is League => Boolean(league))
  }, [teamMatchList, leaguesById])

  const chosenMatch = useMemo(() => teamMatchList.find((match) => match.id === matchId) ?? teamMatchList[0] ?? null, [teamMatchList, matchId])
  const ticked = useMemo(() => teamMatchList.filter((match) => !unticked.has(match.id)), [teamMatchList, unticked])
  const sectionName = sections.data?.find((section) => section.id === team?.sectionId)?.name ?? null
  const subtitle = [sectionName, seasonLabel].filter(Boolean).join('  |  ') || null

  const specs: TeamSheetSpec[] = useMemo(() => {
    if (!team) return []
    const base = { teamName: team.name, subtitle, teamLogoUrl: team.logoUrl, players }
    const forMatch = (match: Match): TeamSheetSpec => {
      const league = match.leagueId ? leaguesById.get(match.leagueId) : undefined
      return { ...base, leagueLogoUrl: league?.logoUrl ?? null, match: matchInfoFor(match, team.id, league?.name ?? null, league?.format) }
    }
    if (mode === 'one') return chosenMatch ? [forMatch(chosenMatch)] : []
    if (mode === 'all') return ticked.map(forMatch)
    const blankLeague = leaguesById.get(blankLeagueId || leagueId || (teamLeagues.length === 1 ? teamLeagues[0].id : ''))
    return [{ ...base, leagueLogoUrl: blankLeague?.logoUrl ?? null, match: { ...EMPTY_MATCH_INFO, league: blankLeague?.name ?? null } }]
  }, [team, subtitle, players, mode, chosenMatch, ticked, leaguesById, blankLeagueId, leagueId, teamLeagues])

  const fileName = useMemo(() => {
    if (!team) return 'Team Sheet.pdf'
    if (mode === 'one' && chosenMatch) {
      return teamSheetFileName({ teamName: team.name, kind: 'match', opposition: specs[0]?.match.opposition, isoDate: chosenMatch.matchDate })
    }
    if (mode === 'all') return teamSheetFileName({ teamName: team.name, kind: 'bundle', leagueName: leagueId ? (leaguesById.get(leagueId)?.name ?? null) : null })
    return teamSheetFileName({ teamName: team.name, kind: 'blank' })
  }, [team, mode, chosenMatch, specs, leagueId, leaguesById])

  const [result, setResult] = useState<{ file: File | null; error: string | null; busy: boolean }>({ file: null, error: null, busy: false })
  useEffect(() => {
    if (!open || specs.length === 0) {
      setResult({ file: null, error: null, busy: false })
      return
    }
    let cancelled = false
    setResult((previous) => ({ ...previous, busy: true }))
    generateTeamSheetPdf(specs, { preMark, fileName })
      .then((file) => !cancelled && setResult({ file, error: null, busy: false }))
      .catch(() => !cancelled && setResult({ file: null, error: 'The PDF could not be created. Try again.', busy: false }))
    return () => {
      cancelled = true
    }
  }, [open, specs, preMark, fileName])

  const empty = squad.isSuccess && players.length === 0
  const noMatches = (mode === 'one' || mode === 'all') && teamMatchList.length === 0
  const preview = specs[0]
  const pages = preview ? sheetPages(preview.players).length : 1
  const fill = !phone
  const title = mode === 'all' ? 'Print Match Sheets' : 'Print Team Sheet'

  const controls = (
    <>
      {teams.length > 1 && (
        <ShareControlGroup label="Team">
          <Input label="Team" select value={team?.id ?? ''} onChange={(event) => setTeamId(event.target.value)} sx={{ minWidth: 220 }}>
            {teams.map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.id}>
                {candidate.name}
              </MenuItem>
            ))}
          </Input>
        </ShareControlGroup>
      )}
      <ShareControlGroup label="Sheet">
        <CompactToggleGroup value={mode} onChange={setMode} ariaLabel="Sheet type" fullWidthOnPhone>
          <ToggleButton value="blank" aria-label="Blank">Blank</ToggleButton>
          <ToggleButton value="one" aria-label="One Match">One Match</ToggleButton>
          <ToggleButton value="all" aria-label="All Matches">All Matches</ToggleButton>
        </CompactToggleGroup>
        {mode === 'blank' && !leagueId && teamLeagues.length > 1 && (
          <Input label="League logo" select value={blankLeagueId} onChange={(event) => setBlankLeagueId(event.target.value)} sx={{ minWidth: 220, mt: 1 }}>
            <MenuItem value="">None</MenuItem>
            {teamLeagues.map((league) => (
              <MenuItem key={league.id} value={league.id}>
                {league.name}
              </MenuItem>
            ))}
          </Input>
        )}
        {mode === 'one' && teamMatchList.length > 0 && (
          <Input label="Match" select value={chosenMatch?.id ?? ''} onChange={(event) => setMatchId(event.target.value)} sx={{ minWidth: 260, mt: 1 }}>
            {teamMatchList.map((match) => (
              <MenuItem key={match.id} value={match.id}>
                {`${when(match)} vs ${matchInfoFor(match, team?.id ?? '', null, null).opposition ?? 'TBC'}`}
              </MenuItem>
            ))}
          </Input>
        )}
        {mode === 'all' && teamMatchList.length > 0 && (
          <Box role="group" aria-label="Matches to print" sx={{ display: 'flex', flexDirection: 'column', mt: 0.5, maxHeight: 220, overflowY: 'auto', width: '100%' }}>
            {teamMatchList.map((match) => (
              <FormControlLabel
                key={match.id}
                sx={{ m: 0 }}
                control={
                  <Checkbox
                    size="small"
                    checked={!unticked.has(match.id)}
                    onChange={(_, checked) =>
                      setUnticked((previous) => {
                        const next = new Set(previous)
                        if (checked) next.delete(match.id)
                        else next.add(match.id)
                        return next
                      })
                    }
                  />
                }
                label={<Typography variant="body2">{`${when(match)} vs ${matchInfoFor(match, team?.id ?? '', null, null).opposition ?? 'TBC'}`}</Typography>}
              />
            ))}
          </Box>
        )}
      </ShareControlGroup>
      <ShareControlGroup label="Include">
        <CompactSwitch label="Pre-Mark Captain And Keepers" checked={preMark} onChange={setPreMark} />
      </ShareControlGroup>
    </>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={phone}
      fullWidth
      maxWidth={false}
      aria-labelledby="team-sheet-title"
      PaperProps={{ sx: { width: { sm: '96vw' }, maxWidth: { sm: '96vw' }, height: { sm: '96vh' }, maxHeight: { sm: '96vh' } } }}
    >
      <DialogTitle id="team-sheet-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}>
        <Box component="span">{title}</Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pb: 2, overflowX: 'hidden', overflowY: fill ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ShareFooterContext.Provider value={footer}>
          <ShareFillContext.Provider value={fill}>
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: fill ? 1 : '0 0 auto', minHeight: 0, minWidth: 0 }}>
              <ShareFormatScreen
                title="PDF"
                controls={controls}
                preview={
                  empty ? (
                    <Alert severity="warning">This team has no players in its squad for this season yet. Add players to the squad first.</Alert>
                  ) : noMatches ? (
                    <Alert severity="info">{mode === 'all' ? 'This team has no matches in this season.' : 'This team has no matches to choose from. Use Blank instead.'}</Alert>
                  ) : preview ? (
                    <Box sx={{ minHeight: 0, overflow: 'auto' }}>
                      <TeamSheetPaperPreview spec={preview} preMark={preMark} pageCount={pages} />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }} data-testid="team-sheet-ready">
                        {result.file ? `${fileName}${specs.length > 1 ? ` (${specs.length} sheets)` : ''}. The preview shows the first page.` : result.error ?? 'Preparing the PDF...'}
                      </Typography>
                    </Box>
                  ) : null
                }
                actions={<SharePdfActions file={empty || noMatches ? null : result.file} shareTitle={`${team?.name ?? 'Team'} team sheet`} error={result.error} />}
              />
            </Box>
          </ShareFillContext.Provider>
        </ShareFooterContext.Provider>
      </DialogContent>
      <DialogActions sx={{ display: 'flex', alignItems: 'center', gap: 1, px: { xs: 2, sm: 3 }, pt: 1.5, pb: 'max(12px, env(safe-area-inset-bottom))', borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box ref={setFooter} data-testid="share-footer" sx={{ minWidth: 0, flex: 1 }} />
        <Button size="compact" variant="secondary" onClick={onClose} sx={{ flexShrink: 0 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
