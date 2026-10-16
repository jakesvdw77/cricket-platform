import { useMemo, useState } from 'react'
import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  InputAdornment,
  ListItemButton,
  MenuItem,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { BottomSheet } from '../../../components/BottomSheet'
import { Button } from '../../../components/Button'
import { CompactSwitch } from '../../../components/CompactSwitch'
import { Input } from '../../../components/Input'
import { listAwaitingResults, resultKeys } from '../../../api/matchResultApi'
import type { Match } from '../../../api/matchApi'
import type { League } from '../../../api/leagueApi'
import type { Team } from '../../../api/teamApi'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { resultCaptureTo, resultImportTo, resultSides } from './resultListHelpers'

const SEARCH_DEBOUNCE_MS = 300
const PAGE_SIZE = 20
const SORT_NEWEST_FIRST = 'matchDate,desc'

export interface CaptureResultDialogProps {
  open: boolean
  onClose: () => void
  clubId: string
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
}

const dateHeading = (matchDate: string) =>
  new Date(matchDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const timeOf = (matchDate: string) =>
  new Date(matchDate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
const dayKey = (matchDate: string) => dateHeading(matchDate) + new Date(matchDate).getFullYear()

interface DateGroup {
  key: string
  heading: string
  matches: Match[]
}

// Matches are returned newest first; consecutive matches on one day share a heading.
function groupByDate(matches: Match[]): DateGroup[] {
  const groups: DateGroup[] = []
  for (const match of matches) {
    const key = dayKey(match.matchDate)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.matches.push(match)
    else groups.push({ key, heading: dateHeading(match.matchDate), matches: [match] })
  }
  return groups
}

function PickerBody({ clubId, teamsById, leaguesById, onPicked, onImport }: Omit<CaptureResultDialogProps, 'open' | 'onClose'> & { onPicked: (match: Match) => void; onImport: () => void }) {
  const [search, setSearch] = useState('')
  const [teamId, setTeamId] = useState('')
  const [includeUpcoming, setIncludeUpcoming] = useState(false)
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)

  const filters = {
    search: debouncedSearch || undefined,
    teamId: teamId || undefined,
    includeUpcoming: includeUpcoming || undefined,
    sort: SORT_NEWEST_FIRST,
  }
  const query = useInfiniteQuery({
    queryKey: [...resultKeys.awaiting(clubId, { page: 0, ...filters }), 'picker'],
    queryFn: ({ pageParam }) => listAwaitingResults(clubId, { page: pageParam, size: PAGE_SIZE, ...filters }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.number + 1 < last.totalPages ? last.number + 1 : undefined),
  })

  const matches = useMemo(() => (query.data?.pages ?? []).flatMap((page) => page.content), [query.data])
  const groups = useMemo(() => groupByDate(matches), [matches])
  const total = query.data?.pages[0]?.totalElements ?? 0
  const teams = Array.from(teamsById.values()).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center', pb: 1.5 }}>
        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
          <Input
            label="Search teams or league"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <Box sx={{ flex: '0 1 180px', minWidth: 140 }}>
          <Input select label="Team" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
            <MenuItem value="">All teams</MenuItem>
            {teams.map((team) => (
              <MenuItem key={team.id} value={team.id}>
                {team.name}
              </MenuItem>
            ))}
          </Input>
        </Box>
        <CompactSwitch checked={includeUpcoming} onChange={setIncludeUpcoming} label="Include upcoming" />
      </Box>

      <Box sx={{ borderTop: 1, borderColor: 'divider', overflowY: 'auto', flex: 1, minHeight: 120, mx: { xs: -2, sm: -3 } }}>
        {query.isPending && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} aria-label="Loading matches" />
          </Box>
        )}
        {query.isError && (
          <Box sx={{ p: 2 }}>
            <Typography color="error" variant="body2" role="alert">
              We couldn't load the matches.{' '}
              <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>
                Retry
              </Button>
            </Typography>
          </Box>
        )}
        {!query.isPending && !query.isError && matches.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2.5, textAlign: 'center' }}>
            {debouncedSearch || teamId
              ? 'No matches waiting for a result match these filters.'
              : includeUpcoming
                ? 'Every match already has a result.'
                : 'No past matches are waiting for a result. Include upcoming to see the rest.'}
          </Typography>
        )}
        {groups.map((group) => (
          <Box key={group.key} component="section" aria-label={group.heading}>
            <Typography
              variant="caption"
              component="h3"
              sx={{ display: 'block', px: { xs: 2, sm: 3 }, py: 1, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06), fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', borderBottom: 1, borderColor: 'divider' }}
            >
              {group.heading} · {group.matches.length} {group.matches.length === 1 ? 'match' : 'matches'}
            </Typography>
            {group.matches.map((match) => {
              const sides = resultSides(match, teamsById)
              const league = match.leagueId ? leaguesById.get(match.leagueId)?.name : undefined
              const bothOurs = Boolean(match.homeTeamId && match.awayTeamId && teamsById.has(match.homeTeamId) && teamsById.has(match.awayTeamId))
              const meta = [timeOf(match.matchDate), league ?? 'Friendly', match.playingAreaName ?? match.venue].filter(Boolean).join(' · ')
              return (
                <ListItemButton
                  key={match.id}
                  onClick={() => onPicked(match)}
                  data-testid="awaiting-match"
                  sx={{ gap: 1.5, px: { xs: 2, sm: 3 }, py: 1.25, minHeight: 64, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Box sx={{ display: 'flex', flex: 'none' }}>
                    {sides.map((side, index) => (
                      <Avatar
                        key={side.side}
                        src={side.logo.src ?? undefined}
                        alt=""
                        aria-hidden
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          bgcolor: (theme) => alpha(theme.palette.primary.main, index === 0 ? 0.14 : 0.2),
                          color: 'primary.dark',
                          ml: index === 0 ? 0 : -1,
                          border: 2,
                          borderColor: 'background.paper',
                        }}
                      >
                        {side.logo.initials}
                      </Avatar>
                    ))}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                      {sides[0].name} v {sides[1].name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                      {meta}
                    </Typography>
                  </Box>
                  {bothOurs && <Chip size="small" label="Both ours" />}
                </ListItemButton>
              )
            })}
          </Box>
        ))}
        {query.hasNextPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 1.5 }}>
            <Button variant="secondary" size="sm" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
              {query.isFetchingNextPage ? 'Loading…' : 'Show more'}
            </Button>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', pt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {total} {total === 1 ? 'match' : 'matches'} waiting · tap a row to start
        </Typography>
        {/* docs/specs/104: a result that already exists elsewhere is imported, not retyped. */}
        <Button variant="secondary" size="sm" onClick={onImport} sx={{ minHeight: 44 }}>
          Import a result instead
        </Button>
      </Box>
    </Box>
  )
}

// docs/specs/100-match-results-core.md: the capture picker behind "Capture result". A dialog on a desktop, a bottom sheet
// on a phone, over GET /results/awaiting (active matches without a result, past by default, newest first): search, team,
// Include upcoming, rows grouped by date. Choosing a row opens the wizard; nothing is saved until its first step is.
export function CaptureResultDialog({ open, onClose, clubId, teamsById, leaguesById }: CaptureResultDialogProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const navigate = useNavigate()
  const picked = (match: Match) => {
    onClose()
    navigate(resultCaptureTo(match.id))
  }
  const importInstead = () => {
    onClose()
    navigate(resultImportTo())
  }

  if (phone) {
    return (
      <BottomSheet open={open} onOpen={() => undefined} onClose={onClose} ariaLabel="Capture a result" title="Capture a result" closeLabel="Close">
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
          {open && <PickerBody clubId={clubId} teamsById={teamsById} leaguesById={leaguesById} onPicked={picked} onImport={importInstead} />}
        </Box>
      </BottomSheet>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-label="Capture a result" PaperProps={{ sx: { maxHeight: 640 } }}>
      <DialogTitle sx={{ pb: 0.5 }}>
        Capture a result
        <Typography variant="body2" color="text.secondary">
          Pick the match. Matches that already have a result are not listed.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', pt: '16px !important', minHeight: 0 }}>
        <PickerBody clubId={clubId} teamsById={teamsById} leaguesById={leaguesById} onPicked={picked} onImport={importInstead} />
      </DialogContent>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 3, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </Box>
    </Dialog>
  )
}
