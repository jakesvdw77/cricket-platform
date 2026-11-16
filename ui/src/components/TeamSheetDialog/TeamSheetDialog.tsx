import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Link, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, ToggleButton, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { useQueries, useQuery } from '@tanstack/react-query'
import { listLeagues } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'
import { listSections } from '../../api/sectionApi'
import { getLeagueSeasonDates } from '../../api/leagueSeasonDatesApi'
import { listMatchSides } from '../../api/matchSideApi'
import { listSquad } from '../../api/teamSquadApi'
import { listTeamSponsors } from '../../api/teamSponsorApi'
import type { Match } from '../../api/matchApi'
import { generateTeamSheetPdf } from '../../utils/share/printableTeamSheetPdf'
import type { NameSort, SideOrder } from '../../utils/teamSheet'
import type { PosterExtras, TeamSheetSpec } from '../../utils/share/printableTeamSheetPdf'
import { BLANK_LINES, EMPTY_MATCH_INFO, matchInfoFor, sheetPages, sheetPlayers, sidePlayers, teamMatches, teamSheetFileName, tournamentRange } from '../../utils/teamSheet'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { Input } from '../Input'
import { ShareControlGroup, SharePdfActions } from '../ShareCore'
import { ShareFillContext, ShareFooterContext, ShareFormatScreen } from '../ShareFormatScreen'
import { selectTeamPath } from '../../pages/manage/teamSelection/selectionLinks'
import { TeamSheetPaperPreview } from './TeamSheetPaperPreview'
import { TeamSheetPosterPreview } from './TeamSheetPosterPreview'

// 'side' (Poster only): the sides saved in Team Selection for the ticked matches, not the whole squad.
type Mode = 'blank' | 'one' | 'all' | 'side'
type Style = 'plain' | 'poster'

export interface TeamSheetTeam {
  id: string
  name: string
  logoUrl: string | null
  sectionId: string | null
  // docs/specs/154: the body the team is affiliated to, for the Poster style's top left.
  affiliationName?: string | null
  affiliationLogoUrl?: string | null
}

// The team as the print screen needs it, from a Team record.
export function sheetTeamOf(team: { id: string; name: string; logoUrl: string | null; sectionId: string; affiliationName?: string | null; affiliationLogoUrl?: string | null }): TeamSheetTeam {
  return { id: team.id, name: team.name, logoUrl: team.logoUrl, sectionId: team.sectionId, affiliationName: team.affiliationName ?? null, affiliationLogoUrl: team.affiliationLogoUrl ?? null }
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
  // The style the print screen opens on; the Poster unless a caller asks for the Plain sheet.
  initialStyle?: Style
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
export function TeamSheetDialog({ open, onClose, clubId, teams, seasonId, seasonLabel, matches, leagueId = null, initialMode = 'blank', initialStyle = 'poster', initialMatchId = null, initialTeamId = null }: TeamSheetDialogProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const [footer, setFooter] = useState<HTMLElement | null>(null)
  const [teamId, setTeamId] = useState<string>(initialTeamId ?? teams[0]?.id ?? '')
  const [rawMode, setMode] = useState<Mode>(initialMode)
  const [sideOrder, setSideOrder] = useState<SideOrder>('batting')
  const [nameSort, setNameSort] = useState<NameSort>('surname')
  const [matchId, setMatchId] = useState<string>(initialMatchId ?? '')
  const [unticked, setUnticked] = useState<Set<string>>(new Set())
  const [blankLeagueId, setBlankLeagueId] = useState<string>('')
  const [preMark, setPreMark] = useState(false)
  const [extraLines, setExtraLines] = useState(true)
  const [tossBoxes, setTossBoxes] = useState(false)
  const [leaderTicks, setLeaderTicks] = useState(true)
  const [style, setStyle] = useState<Style>(initialStyle)
  const [batBowl, setBatBowl] = useState(true)
  const [playingBox, setPlayingBox] = useState(true)
  const [comment, setComment] = useState(true)
  // The Selected Side sheet only exists in the Poster style; switching to Plain falls back to One Match.
  const mode: Mode = style === 'plain' && rawMode === 'side' ? 'one' : rawMode
  const team = teams.find((candidate) => candidate.id === teamId) ?? teams[0] ?? null

  const leagues = useQuery({ queryKey: ['managed-club', clubId, 'leagues', 'team-sheet'], queryFn: () => listLeagues(clubId), enabled: open && Boolean(clubId) })
  const squad = useQuery({
    queryKey: ['managed-club', clubId, 'teams', team?.id, 'seasons', seasonId, 'squad'],
    queryFn: () => listSquad(clubId, team?.id as string, seasonId),
    enabled: open && Boolean(clubId) && Boolean(team) && Boolean(seasonId),
  })
  const sponsors = useQuery({
    queryKey: ['managed-club', clubId, 'teams', team?.id, 'sponsors'],
    queryFn: () => listTeamSponsors(clubId, team?.sectionId as string, team?.id as string),
    enabled: open && style === 'poster' && Boolean(clubId) && Boolean(team?.sectionId),
  })
  const sections = useQuery({ queryKey: ['managed-club', clubId, 'sections'], queryFn: () => listSections(clubId), enabled: open && Boolean(clubId) })

  const leaguesById = useMemo(() => new Map<string, League>((leagues.data ?? []).map((league) => [league.id, league])), [leagues.data])
  const teamMatchList = useMemo(
    () => (team ? teamMatches(matches, team.id).filter((match) => !leagueId || match.leagueId === leagueId) : []),
    [matches, team, leagueId],
  )
  const players = useMemo(() => sheetPlayers(squad.data ?? [], nameSort), [squad.data, nameSort])

  // The leagues this team plays in this season, for the blank sheet's league logo.
  const teamLeagues = useMemo(() => {
    const ids = [...new Set(teamMatchList.map((match) => match.leagueId).filter((id): id is string => Boolean(id)))]
    return ids.map((id) => leaguesById.get(id)).filter((league): league is League => Boolean(league))
  }, [teamMatchList, leaguesById])

  // The tournament's own start and end dates (spec 111) for each league this team plays in, for the Poster's dates line.
  const seasonDates = useQueries({
    queries: teamLeagues.map((league) => ({
      queryKey: ['managed-club', clubId, 'leagues', league.id, 'seasons', seasonId, 'dates'],
      queryFn: () => getLeagueSeasonDates(clubId, league.id, seasonId),
      enabled: open && style === 'poster' && Boolean(clubId) && Boolean(seasonId),
    })),
  })
  const datesByLeague = useMemo(
    () => new Map(teamLeagues.map((league, index) => [league.id, seasonDates[index]?.data ?? null] as const)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamLeagues, seasonDates.map((query) => query.data).join('|')],
  )

  const chosenMatch = useMemo(() => teamMatchList.find((match) => match.id === matchId) ?? teamMatchList[0] ?? null, [teamMatchList, matchId])
  const ticked = useMemo(() => teamMatchList.filter((match) => !unticked.has(match.id)), [teamMatchList, unticked])
  // Selected Side: each ticked match's saved side, read when the sheet type is on.
  const sideQueries = useQueries({
    queries: (mode === 'side' ? ticked : []).map((match) => ({
      queryKey: ['managed-club', clubId, 'matches', match.id, 'sides'],
      queryFn: () => listMatchSides(clubId, match.id),
      enabled: open && Boolean(clubId),
    })),
  })
  // Each ticked match's saved side for this team. Keyed on the reads' own update times so a new array of query results does not rebuild
  // the sheets on every render.
  const sidesKey = sideQueries.map((query) => `${query.status}:${query.dataUpdatedAt}`).join('|')
  const sidesByMatch = useMemo(
    () => new Map(ticked.map((match, index) => [match.id, sideQueries[index]?.data?.find((candidate) => candidate.teamId === team?.id) ?? null] as const)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticked, sidesKey, team?.id],
  )
  const sectionName = sections.data?.find((section) => section.id === team?.sectionId)?.name ?? null
  const subtitle = [sectionName, seasonLabel].filter(Boolean).join('  |  ') || null

  const specs: TeamSheetSpec[] = useMemo(() => {
    if (!team) return []
    const base = { teamName: team.name, subtitle, teamLogoUrl: team.logoUrl, players }
    const sponsorLogoUrls = (sponsors.data ?? []).map((sponsor) => sponsor.logoUrl).filter((url): url is string => Boolean(url))
    // The Poster's extras for a league: its name and year, the tournament dates (our team's first to last match in it), the team's
    // affiliation, the league's host and the team's sponsors.
    const posterFor = (league: League | undefined): PosterExtras | undefined => {
      if (style !== 'poster') return undefined
      const dates = teamMatchList.filter((match) => !league || match.leagueId === league.id).map((match) => match.matchDate)
      const year = dates.length > 0 ? String(new Date([...dates].sort()[0]).getFullYear()) : null
      return {
        leagueTitle: league ? [league.name, year].filter(Boolean).join(' ') : null,
        // The tournament's saved start and end; else the first to last match of our team in it.
        dateRange: league ? (datesByLeague.get(league.id) ? tournamentRange([`${datesByLeague.get(league.id)?.startDate}T00:00:00`, `${datesByLeague.get(league.id)?.endDate}T00:00:00`]) : tournamentRange(dates)) : null,
        affiliationName: team.affiliationName ?? null,
        affiliationLogoUrl: team.affiliationLogoUrl ?? null,
        leagueAffiliationName: league?.affiliationName ?? null,
        leagueAffiliationLogoUrl: league?.affiliationLogoUrl ?? null,
        hostName: league?.hostName ?? null,
        hostLogoUrl: league?.hostLogoUrl ?? null,
        sponsorLogoUrls,
      }
    }
    const forMatch = (match: Match): TeamSheetSpec => {
      const league = match.leagueId ? leaguesById.get(match.leagueId) : undefined
      return { ...base, leagueLogoUrl: league?.logoUrl ?? null, match: matchInfoFor(match, team.id, league?.name ?? null, league?.format), poster: posterFor(league) }
    }
    if (mode === 'side') {
      // Only matches whose saved side has players print; the others are listed as skipped under the preview.
      return ticked.flatMap((match) => {
        const side = sidesByMatch.get(match.id)
        const sidePlayersList = side ? sidePlayers(side, squad.data ?? [], sideOrder, nameSort) : []
        return sidePlayersList.length > 0 ? [{ ...forMatch(match), players: sidePlayersList, selectedSide: true }] : []
      })
    }
    if (mode === 'one') return chosenMatch ? [forMatch(chosenMatch)] : []
    if (mode === 'all') return ticked.map(forMatch)
    const blankLeague = leaguesById.get(blankLeagueId || leagueId || (teamLeagues.length === 1 ? teamLeagues[0].id : ''))
    return [{ ...base, leagueLogoUrl: blankLeague?.logoUrl ?? null, match: { ...EMPTY_MATCH_INFO, league: blankLeague?.name ?? null }, poster: posterFor(blankLeague) }]
  }, [team, subtitle, players, mode, chosenMatch, ticked, leaguesById, blankLeagueId, leagueId, teamLeagues, style, sponsors.data, teamMatchList, datesByLeague, sidesByMatch, squad.data, sideOrder, nameSort])

  const fileName = useMemo(() => {
    if (!team) return 'Team Sheet.pdf'
    if (mode === 'one' && chosenMatch) {
      return teamSheetFileName({ teamName: team.name, kind: 'match', opposition: specs[0]?.match.opposition, isoDate: chosenMatch.matchDate })
    }
    if (mode === 'side' && specs.length === 1) {
      const only = ticked.find((match) => matchInfoFor(match, team.id, null, null).opposition === specs[0].match.opposition)
      return teamSheetFileName({ teamName: team.name, kind: 'match', opposition: specs[0].match.opposition, isoDate: only?.matchDate })
    }
    if (mode === 'all' || mode === 'side') return teamSheetFileName({ teamName: team.name, kind: 'bundle', leagueName: leagueId ? (leaguesById.get(leagueId)?.name ?? null) : null })
    return teamSheetFileName({ teamName: team.name, kind: 'blank' })
  }, [team, mode, chosenMatch, specs, ticked, leagueId, leaguesById])

  const [result, setResult] = useState<{ file: File | null; error: string | null; busy: boolean }>({ file: null, error: null, busy: false })
  useEffect(() => {
    if (!open || specs.length === 0) {
      setResult({ file: null, error: null, busy: false })
      return
    }
    let cancelled = false
    setResult((previous) => ({ ...previous, busy: true }))
    generateTeamSheetPdf(specs, { preMark, extraLines, tossBoxes, leaderTicks, style, batBowl, playingBox, comment, fileName })
      .then((file) => !cancelled && setResult({ file, error: null, busy: false }))
      .catch(() => !cancelled && setResult({ file: null, error: 'The PDF could not be created. Try again.', busy: false }))
    return () => {
      cancelled = true
    }
  }, [open, specs, preMark, extraLines, tossBoxes, leaderTicks, style, batBowl, playingBox, comment, fileName])

  const empty = squad.isSuccess && players.length === 0 && mode !== 'side'
  const noMatches = mode !== 'blank' && teamMatchList.length === 0
  // Selected Side: ticked matches with no saved side yet (once every read has answered).
  const sidesLoaded = mode === 'side' && sideQueries.length > 0 && sideQueries.every((query) => query.isSuccess)
  const skipped = sidesLoaded
    ? ticked.filter((match) => !(sidesByMatch.get(match.id)?.players.length ?? 0))
    : []
  const noSides = sidesLoaded && specs.length === 0
  const preview = specs[0]
  const pages = preview ? sheetPages(preview.players, extraLines && !preview.selectedSide ? BLANK_LINES : 0).length : 1
  const fill = !phone
  const title = mode === 'all' || mode === 'side' ? 'Print Match Sheets' : 'Print Team Sheet'

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
      <ShareControlGroup label="Style">
        <CompactToggleGroup<Style> value={style} onChange={setStyle} ariaLabel="Sheet style" fullWidthOnPhone>
          <ToggleButton value="plain" aria-label="Plain">Plain</ToggleButton>
          <ToggleButton value="poster" aria-label="Poster">Poster</ToggleButton>
        </CompactToggleGroup>
      </ShareControlGroup>
      <ShareControlGroup label="Sheet">
        <CompactToggleGroup<Mode> value={mode} onChange={setMode} ariaLabel="Sheet type" fullWidthOnPhone>
          <ToggleButton value="blank" aria-label="Blank">Blank</ToggleButton>
          <ToggleButton value="one" aria-label="One Match">One Match</ToggleButton>
          <ToggleButton value="all" aria-label="All Matches">All Matches</ToggleButton>
          {style === 'poster' && <ToggleButton value="side" aria-label="Selected Side">Selected Side</ToggleButton>}
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
        {(mode === 'all' || mode === 'side') && teamMatchList.length > 0 && (
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
      {mode === 'side' && (
        <ShareControlGroup label="Order">
          <CompactToggleGroup<SideOrder> value={sideOrder} onChange={setSideOrder} ariaLabel="Player order" fullWidthOnPhone>
            <ToggleButton value="batting" aria-label="Batting Order">Batting Order</ToggleButton>
            <ToggleButton value="alphabetical" aria-label="Alphabetical">Alphabetical</ToggleButton>
          </CompactToggleGroup>
        </ShareControlGroup>
      )}
      <ShareControlGroup label="Sort By">
        <CompactToggleGroup<NameSort> value={nameSort} onChange={setNameSort} ariaLabel="Sort names by" fullWidthOnPhone>
          <ToggleButton value="surname" aria-label="Surname">Surname</ToggleButton>
          <ToggleButton value="firstName" aria-label="First Name">First Name</ToggleButton>
        </CompactToggleGroup>
      </ShareControlGroup>
      <ShareControlGroup label="Include">
        {mode !== 'side' && <CompactSwitch label="Pre-Mark Captain And Keepers" checked={preMark} onChange={setPreMark} />}
        {mode !== 'side' && <CompactSwitch label="Two Lines For Late Or Guest Players" checked={extraLines} onChange={setExtraLines} />}
        {style === 'plain' ? (
          <>
            <CompactSwitch label="Toss And Elected Boxes" checked={tossBoxes} onChange={setTossBoxes} />
            <CompactSwitch label="Capt And Keeper Tick Boxes" checked={leaderTicks} onChange={setLeaderTicks} />
          </>
        ) : (
          <>
            {mode !== 'side' && <CompactSwitch label="Playing Tick Box" checked={playingBox} onChange={setPlayingBox} />}
            <CompactSwitch label="Bat Pos And Bowl Columns" checked={batBowl} onChange={setBatBowl} />
            <CompactSwitch label="Comment Column" checked={comment} onChange={setComment} />
          </>
        )}
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
                    <Alert severity="info">{mode === 'all' || mode === 'side' ? 'This team has no matches in this season.' : 'This team has no matches to choose from. Use Blank instead.'}</Alert>
                  ) : noSides ? (
                    <Alert severity="info">
                      No side has been selected for the ticked {ticked.length === 1 ? 'match' : 'matches'} yet.{' '}
                      {ticked[0] && (
                        <Link component={RouterLink} to={selectTeamPath(ticked[0].id, null, Boolean(ticked[0].homeTeamId))} underline="always">
                          Open Team Selection
                        </Link>
                      )}
                    </Alert>
                  ) : preview ? (
                    <Box sx={{ minHeight: 0, overflow: 'auto' }}>
                      {style === 'poster' ? (
                        <TeamSheetPosterPreview spec={preview} preMark={preMark} extraLines={extraLines} batBowl={batBowl} playingBox={playingBox} comment={comment} pageCount={pages} />
                      ) : (
                        <TeamSheetPaperPreview spec={preview} preMark={preMark} extraLines={extraLines} tossBoxes={tossBoxes} leaderTicks={leaderTicks} pageCount={pages} />
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }} data-testid="team-sheet-ready">
                        {result.file ? `${fileName}${specs.length > 1 ? ` (${specs.length} sheets)` : ''}. The preview shows the first page.` : result.error ?? 'Preparing the PDF...'}
                      </Typography>
                      {skipped.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }} data-testid="team-sheet-skipped">
                          {`Skipped, no side selected yet: ${skipped.map((match) => matchInfoFor(match, team?.id ?? '', null, null).opposition ?? 'TBC').join(', ')}.`}
                        </Typography>
                      )}
                    </Box>
                  ) : null
                }
                actions={<SharePdfActions file={empty || noMatches || noSides ? null : result.file} shareTitle={`${team?.name ?? 'Team'} team sheet`} error={result.error} />}
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
