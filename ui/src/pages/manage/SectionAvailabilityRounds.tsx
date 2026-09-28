import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  Menu,
  MenuItem,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink, useOutletContext, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardField } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { SectionTreeSelect } from '../../components/SectionTreeSelect'
import { EmptyState } from '../../components/EmptyState'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { SectionAvailabilityShareDialog } from '../../components/SectionAvailabilityShareDialog'
import {
  listRounds,
  openRound,
  closeRound,
  getRoundMatches,
  getRoundResponses,
  setRoundPlayerStatus,
  updateRoundDescription,
  getFixtureGroups,
  createRound,
} from '../../api/sectionAvailabilityApi'
import type {
  SectionAvailabilityRound,
  SectionAvailabilityRoundResponseRow,
  SectionAvailabilityFixtureGroup,
  SectionAvailabilityFixtureMatch,
} from '../../api/sectionAvailabilityApi'
import type { AvailabilityStatus } from '../../api/matchAvailabilityApi'
import { listSections } from '../../api/sectionApi'
import { usePersistedListFilters } from '../../hooks/usePersistedListFilters'
import { errorDetail } from '../../utils/errorDetail'
import { DAY_PART_LABEL, formatBracketLabel } from '../../utils/dayPart'
import { STATUS_COLOR, STATUS_LABEL } from '../../utils/availabilityStatus'

const STATUS_OPTIONS: AvailabilityStatus[] = ['AVAILABLE', 'UNAVAILABLE', 'UNSURE']

const DAY_IN_MS = 24 * 60 * 60 * 1000

function formatDateRange(startDate: string, endDate: string): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
  const startLabel = new Date(startDate).toLocaleDateString(undefined, options)
  if (startDate === endDate) {
    return startLabel
  }
  const endLabel = new Date(endDate).toLocaleDateString(undefined, options)
  return `${startLabel} - ${endLabel}`
}

function formatMatchDateTime(matchDate: string): string {
  return new Date(matchDate).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function matchLabel(match: SectionAvailabilityFixtureMatch): string {
  return `${match.teamName} vs ${match.opponentLabel}`
}

// The earliest currently-ticked match's own kickoff minus 24 hours, recomputed client-side as
// matches are ticked/unticked - purely a display preview of what the backend will itself compute
// and store as scheduledCloseAt at creation time (docs/specs/063's Data Model Changes).
function computeScheduledCloseAt(matches: SectionAvailabilityFixtureMatch[], selectedIds: Set<string>): Date | null {
  const selectedTimes = matches
    .filter((match) => selectedIds.has(match.matchId))
    .map((match) => new Date(match.matchDate).getTime())
  if (selectedTimes.length === 0) {
    return null
  }
  return new Date(Math.min(...selectedTimes) - DAY_IN_MS)
}

// One proposed group per SectionAvailabilityFixtureGroupResolver's own clustering - an editable
// description, an Autoclose toggle with a live-recomputed close-time preview, an
// uncheck-to-exclude match list (an already-polled match can't be checked at all), and the
// group's own "Open poll" action. Owns its own local selection/description/autoClose state,
// initialized from the group prop once, mirroring RoundCard's own per-card-owns-its-own-mutation
// isolation convention.
function FixtureGroupCard({
  clubId,
  sectionId,
  group,
  onCreated,
}: {
  clubId: string
  sectionId: string
  group: SectionAvailabilityFixtureGroup
  onCreated: () => void
}) {
  const [description, setDescription] = useState(group.suggestedDescription)
  const [autoClose, setAutoClose] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(group.matches.filter((match) => !match.alreadyPolled).map((match) => match.matchId)),
  )

  const createMutation = useMutation({
    mutationFn: () =>
      createRound(clubId, {
        sectionId,
        description: description.trim(),
        matchIds: Array.from(selectedIds),
        autoClose,
      }),
    onSuccess: onCreated,
  })

  const toggleMatch = (matchId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(matchId)) {
        next.delete(matchId)
      } else {
        next.add(matchId)
      }
      return next
    })
  }

  const scheduledCloseAt = autoClose ? computeScheduledCloseAt(group.matches, selectedIds) : null
  const canSubmit = selectedIds.size > 0 && description.trim().length > 0 && !createMutation.isPending

  return (
    <Card variant="outlined">
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" useFlexGap spacing={1}>
          <Typography variant="subtitle1" fontWeight={600}>
            {formatDateRange(group.startDate, group.endDate)}
          </Typography>
          <Chip size="small" label={`${group.matches.length} fixture${group.matches.length === 1 ? '' : 's'}`} />
        </Stack>

        <Input label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />

        <Stack spacing={0.5}>
          <FormControlLabel
            control={<Switch checked={autoClose} onChange={(event) => setAutoClose(event.target.checked)} />}
            label="Autoclose"
          />
          {autoClose && scheduledCloseAt && (
            <Typography variant="caption" color="text.secondary">
              Automatically closes {scheduledCloseAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} -
              24 hours before the earliest selected fixture.
            </Typography>
          )}
        </Stack>

        <Divider />

        <Stack spacing={1.5}>
          {group.matches.map((match) => (
            <Stack
              key={match.matchId}
              direction="row"
              alignItems="flex-start"
              spacing={1}
              sx={{ opacity: match.alreadyPolled ? 0.6 : 1 }}
            >
              <Checkbox
                checked={selectedIds.has(match.matchId)}
                disabled={match.alreadyPolled}
                onChange={() => toggleMatch(match.matchId)}
                inputProps={{ 'aria-label': `Include ${matchLabel(match)}` }}
              />
              <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="body2" fontWeight={600}>
                    {matchLabel(match)}
                  </Typography>
                  <Chip size="small" variant="outlined" label={DAY_PART_LABEL[match.dayPart]} />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {formatMatchDateTime(match.matchDate)}
                  {match.leagueName ? ` - ${match.leagueName}` : ''}
                </Typography>
                {match.alreadyPolled && (
                  <Typography variant="caption" color="text.secondary">
                    Already covered by{' '}
                    <RouterLink to={`/section-availability/${match.existingRoundId}`}>
                      {match.existingRoundDescription}
                    </RouterLink>
                  </Typography>
                )}
              </Stack>
            </Stack>
          ))}
        </Stack>

        {createMutation.isError && (
          <Alert severity="error">
            {errorDetail(createMutation.error, 'Something went wrong opening this poll. Please try again.')}
          </Alert>
        )}

        <Box>
          <Button disabled={!canSubmit} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? 'Opening…' : `Open poll for ${selectedIds.size} selected fixture${selectedIds.size === 1 ? '' : 's'}`}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

// However many brackets this round actually owns, one to several - no longer a fixed
// Morning/Afternoon pair (docs/specs/063's fixture-group-selection revision).
function roundFields(round: SectionAvailabilityRound): RecordCardField[] {
  const totalMatches = round.brackets.reduce((sum, bracket) => sum + bracket.coveredMatchCount, 0)
  return [
    ...round.brackets.map((bracket) => ({
      label: formatBracketLabel(bracket.windowDate, bracket.dayPart),
      value: `${bracket.availableCount} yes / ${bracket.unavailableCount} no / ${bracket.unsureCount} unsure`,
    })),
    { label: 'Matches covered', value: totalMatches },
  ]
}

function playerDisplayName(row: SectionAvailabilityRoundResponseRow): string {
  const name = `${row.firstName} ${row.lastName}`
  return row.jerseyNumber != null ? `#${row.jerseyNumber} ${name}` : name
}

// The admin-override entry point - mirrors MatchAvailabilityTab.tsx's own StatusMenuChip exactly
// (a squad member's status Chip doubles as a menu trigger), just resolved per bracket (identified
// by its own windowId, since a round can now own several windows sharing the same dayPart across
// different dates) instead of per match/side. Disabled while the round is closed, matching the
// backend's own rule (round open/close cascades to every underlying window in lockstep).
function BracketStatusChip({
  windowId,
  dayPart,
  windowDate,
  status,
  disabled,
  pending,
  playerName,
  onSelect,
}: {
  windowId: string
  dayPart: 'MORNING' | 'AFTERNOON'
  windowDate: string
  status: AvailabilityStatus | null
  disabled: boolean
  pending: boolean
  playerName: string
  onSelect: (windowId: string, status: AvailabilityStatus) => void
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const label = formatBracketLabel(windowDate, dayPart)

  const chipProps = status
    ? {
        label: `${label}: ${STATUS_LABEL[status]}`,
        sx: {
          bgcolor: (theme: Theme) => alpha(theme.palette[STATUS_COLOR[status]].main, 0.12),
          color: `${STATUS_COLOR[status]}.dark`,
          fontWeight: 600,
        },
      }
    : { label: `${label}: No response`, variant: 'outlined' as const }

  return (
    <>
      <Chip
        {...chipProps}
        size="small"
        disabled={disabled || pending}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-label={`Set ${playerName}'s ${label.toLowerCase()} availability`}
      />
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {STATUS_OPTIONS.map((option) => (
          <MenuItem
            key={option}
            selected={option === status}
            onClick={() => {
              setAnchorEl(null)
              onSelect(windowId, option)
            }}
          >
            {STATUS_LABEL[option]}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

// One RecordCard per round, plus its own expandable "covered matches"/"responses" lists, an
// inline description editor, and share dialog - mirrors AvailabilityPollsDashboard.tsx's own
// PollCard isolation pattern (each card owns its own mutations so one card's pending state never
// leaks onto another's).
function RoundCard({
  clubId,
  round,
  onChanged,
}: {
  clubId: string
  round: SectionAvailabilityRound
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const [matchesOpen, setMatchesOpen] = useState(false)
  const [responsesOpen, setResponsesOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState(round.description)
  const [settingKey, setSettingKey] = useState<string | null>(null)

  const toggleMutation = useMutation({
    mutationFn: () => (round.open ? closeRound(clubId, round.id) : openRound(clubId, round.id)),
    onSuccess: onChanged,
  })

  const descriptionMutation = useMutation({
    mutationFn: (description: string) => updateRoundDescription(clubId, round.id, description),
    onSuccess: () => {
      onChanged()
      setEditOpen(false)
    },
  })

  const matchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-rounds', round.id, 'matches'],
    queryFn: () => getRoundMatches(clubId, round.id),
    enabled: matchesOpen,
  })

  const responsesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-rounds', round.id, 'responses'],
    queryFn: () => getRoundResponses(clubId, round.id),
    enabled: responsesOpen,
  })

  const setStatusMutation = useMutation({
    mutationFn: ({ playerProfileId, windowId, status }: { playerProfileId: string; windowId: string; status: AvailabilityStatus }) =>
      setRoundPlayerStatus(clubId, round.id, playerProfileId, windowId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'section-availability-rounds', round.id, 'responses'] })
      onChanged()
    },
    onSettled: () => setSettingKey(null),
  })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <RecordCard
        title={round.description}
        description={round.sectionName}
        avatar={{ fallback: <EventAvailableOutlinedIcon fontSize="small" />, shape: 'rounded' }}
        badge={{ label: round.open ? 'Open' : 'Closed', tone: round.open ? 'positive' : 'muted' }}
        fields={roundFields(round)}
        secondaryAction={{
          label: round.open ? 'Close' : 'Reopen',
          pendingLabel: round.open ? 'Closing…' : 'Reopening…',
          pending: toggleMutation.isPending,
          onClick: () => toggleMutation.mutate(),
          icon: round.open ? <LockOutlinedIcon fontSize="small" /> : <LockOpenOutlinedIcon fontSize="small" />,
        }}
        secondaryActions={[
          {
            label: editOpen ? 'Hide description editor' : 'Edit description',
            pendingLabel: 'Edit description',
            pending: false,
            onClick: () => {
              setDescriptionDraft(round.description)
              setEditOpen((prev) => !prev)
            },
            icon: <EditOutlinedIcon fontSize="small" />,
          },
          {
            label: matchesOpen ? 'Hide covered matches' : 'View covered matches',
            pendingLabel: 'View covered matches',
            pending: false,
            onClick: () => setMatchesOpen((prev) => !prev),
            icon: <EventNoteOutlinedIcon fontSize="small" />,
          },
          {
            label: responsesOpen ? 'Hide responses' : 'View responses',
            pendingLabel: 'View responses',
            pending: false,
            onClick: () => setResponsesOpen((prev) => !prev),
            icon: <PeopleAltOutlinedIcon fontSize="small" />,
          },
          {
            label: 'Share invite',
            pendingLabel: 'Share invite',
            pending: false,
            onClick: () => setShareOpen(true),
            icon: <ShareOutlinedIcon fontSize="small" />,
          },
        ]}
        feedback={
          toggleMutation.isError
            ? { message: errorDetail(toggleMutation.error, 'Something went wrong updating this round. Please try again.'), tone: 'error' }
            : null
        }
      />

      <Collapse in={editOpen}>
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'background.paper' }}>
          <Stack spacing={1.5}>
            <Input
              label="Description"
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
            />
            {descriptionMutation.isError && (
              <Typography variant="body2" color="error.main">
                {errorDetail(descriptionMutation.error, 'Something went wrong saving this description. Please try again.')}
              </Typography>
            )}
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!descriptionDraft.trim() || descriptionMutation.isPending}
                onClick={() => descriptionMutation.mutate(descriptionDraft.trim())}
              >
                {descriptionMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Collapse>

      <Collapse in={matchesOpen}>
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'background.paper' }}>
          {matchesQuery.isLoading && (
            <Typography variant="body2" color="text.secondary">
              Loading covered matches…
            </Typography>
          )}
          {!matchesQuery.isLoading && (
            <Stack spacing={2}>
              {round.brackets.map((bracket) => {
                const matchesForBracket = (matchesQuery.data ?? []).filter((match) => match.windowId === bracket.windowId)
                return (
                  <Stack key={bracket.windowId} spacing={1}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {formatBracketLabel(bracket.windowDate, bracket.dayPart)}
                    </Typography>
                    {matchesForBracket.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No matches in this bracket.
                      </Typography>
                    )}
                    {matchesForBracket.map((match) => (
                      <Stack key={`${match.matchId}-${match.teamId}`} direction="row" justifyContent="space-between" spacing={1.5}>
                        <Typography variant="body2">
                          {match.teamName} vs {match.opponentLabel}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(match.matchDate).toLocaleString()}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )
              })}
            </Stack>
          )}
        </Box>
      </Collapse>

      <Collapse in={responsesOpen}>
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'background.paper' }}>
          {responsesQuery.isLoading && (
            <Typography variant="body2" color="text.secondary">
              Loading responses…
            </Typography>
          )}
          {!responsesQuery.isLoading && (responsesQuery.data?.responses ?? []).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No eligible players for this section yet.
            </Typography>
          )}
          {!responsesQuery.isLoading && (responsesQuery.data?.responses ?? []).length > 0 && (
            <Stack spacing={1}>
              {(responsesQuery.data?.responses ?? []).map((row) => (
                <Stack
                  key={row.playerProfileId}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  flexWrap="wrap"
                  useFlexGap
                  spacing={1}
                  sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}
                >
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {playerDisplayName(row)}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {row.statuses.map((entry) => (
                      <BracketStatusChip
                        key={entry.windowId}
                        windowId={entry.windowId}
                        dayPart={entry.dayPart}
                        windowDate={entry.windowDate}
                        status={entry.status}
                        disabled={!round.open}
                        pending={settingKey === `${row.playerProfileId}:${entry.windowId}`}
                        playerName={playerDisplayName(row)}
                        onSelect={(windowId, status) => {
                          setSettingKey(`${row.playerProfileId}:${windowId}`)
                          setStatusMutation.mutate({ playerProfileId: row.playerProfileId, windowId, status })
                        }}
                      />
                    ))}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>
      </Collapse>

      <SectionAvailabilityShareDialog open={shareOpen} onClose={() => setShareOpen(false)} round={round} />
    </Box>
  )
}

// docs/specs/063-section-availability-and-flexible-squads.md Part A: a section-scoped, club-wide
// list of every SectionAvailabilityRound, together with a review of a chosen section's own
// proposed fixture groups above it - one continuous screen, not two disconnected ones (see the
// spec's UI Requirements Part A note that a dialog/second page left no room to review a real
// fixture list, then folded that review back into this same page rather than keeping it as its
// own route). Follows docs/standards/frontend.md's required list-screen shape (ManageScreenHeader
// + ListToolbar + RecordCard grid) for the open-rounds half, same as AvailabilityPollsDashboard's
// own precedent, with the proposed-groups review stacked above it.
export default function SectionAvailabilityRounds() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'asc' | 'desc'>('asc')

  // The proposed-groups section's own section picker - pre-filled from ?sectionId= when reached
  // via MatchFormPage's "no window yet" shortcut, chosen manually otherwise. Deliberately its own
  // state, independent of the open-rounds list's persisted Section filter below - reviewing
  // fixtures for one section doesn't imply filtering the open-rounds list to match.
  const [proposedSectionId, setProposedSectionId] = useState<string | null>(searchParams.get('sectionId'))

  const [{ sectionId }, setFilters] = usePersistedListFilters(`sectionAvailabilityRounds:filters:${clubId}`, {
    sectionId: null as string | null,
  })

  const roundsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-rounds', sectionId],
    queryFn: () => listRounds(clubId as string, { sectionId: sectionId ?? undefined }),
    enabled: Boolean(clubId),
  })

  const { data: sections } = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })

  const fixtureGroupsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-fixture-groups', proposedSectionId],
    queryFn: () => getFixtureGroups(clubId as string, proposedSectionId as string),
    enabled: Boolean(clubId) && Boolean(proposedSectionId),
  })

  const invalidateRounds = () =>
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'section-availability-rounds'] })

  const handleGroupCreated = () => {
    invalidateRounds()
    queryClient.invalidateQueries({
      queryKey: ['managed-club', clubId, 'section-availability-fixture-groups', proposedSectionId],
    })
  }

  const proposedGroups = useMemo(() => fixtureGroupsQuery.data ?? [], [fixtureGroupsQuery.data])

  const visibleRounds = useMemo(() => {
    const rounds = roundsQuery.data ?? []
    const term = search.trim().toLowerCase()
    const filtered = term
      ? rounds.filter(
          (round) => round.sectionName.toLowerCase().includes(term) || round.description.toLowerCase().includes(term),
        )
      : rounds
    const sorted = [...filtered].sort((a, b) => new Date(a.firstMatchDate).getTime() - new Date(b.firstMatchDate).getTime())
    return sort === 'desc' ? sorted.reverse() : sorted
  }, [roundsQuery.data, search, sort])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  const isSearching = search.trim().length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader title="Section Availability" />

      <Stack spacing={2}>
        <Typography variant="h6">Propose a new poll</Typography>
        <SectionTreeSelect
          label="Section"
          sections={sections ?? []}
          value={proposedSectionId}
          onChange={setProposedSectionId}
        />

        {!proposedSectionId && (
          <EmptyState
            title="Choose a section"
            description="Pick a section to review its upcoming fixtures and choose which ones this poll should cover."
          />
        )}

        {proposedSectionId && fixtureGroupsQuery.isLoading && (
          <Typography variant="body2" color="text.secondary">
            Loading upcoming fixtures…
          </Typography>
        )}

        {proposedSectionId && !fixtureGroupsQuery.isLoading && fixtureGroupsQuery.isError && (
          <EmptyState
            title="Couldn't load upcoming fixtures"
            description="Something went wrong loading this section's upcoming fixtures. Please try again."
          />
        )}

        {proposedSectionId && !fixtureGroupsQuery.isLoading && !fixtureGroupsQuery.isError && proposedGroups.length === 0 && (
          <EmptyState
            title="No upcoming fixtures"
            description="This section has no upcoming fixtures from a flexible-squad team yet."
          />
        )}

        {proposedSectionId && proposedGroups.length > 0 && (
          <Stack spacing={2}>
            {proposedGroups.map((group) => (
              <FixtureGroupCard
                key={`${group.startDate}-${group.endDate}`}
                clubId={clubId}
                sectionId={proposedSectionId}
                group={group}
                onCreated={handleGroupCreated}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <Divider />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by section or description"
        sortToggle={{
          value: sort,
          ascLabel: 'First match date, soonest first',
          descLabel: 'First match date, latest first',
          onToggle: () => setSort(sort === 'asc' ? 'desc' : 'asc'),
        }}
        filters={
          <SectionTreeSelect
            label="Section"
            sections={sections ?? []}
            value={sectionId}
            onChange={(value) => setFilters({ sectionId: value })}
            allowClear
          />
        }
      />

      {roundsQuery.isLoading && null}

      {!roundsQuery.isLoading && roundsQuery.isError && (
        <EmptyState
          title="Couldn't load section availability rounds"
          description="Something went wrong loading your club's section availability rounds. Please try again."
        />
      )}

      {!roundsQuery.isLoading && !roundsQuery.isError && visibleRounds.length > 0 && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
          {visibleRounds.map((round) => (
            <RoundCard key={round.id} clubId={clubId} round={round} onChanged={invalidateRounds} />
          ))}
        </Box>
      )}

      {!roundsQuery.isLoading && !roundsQuery.isError && visibleRounds.length === 0 && isSearching && (
        <EmptyState
          title="No matching rounds"
          description={`No section availability rounds match "${search.trim()}". Try a different search.`}
        />
      )}

      {!roundsQuery.isLoading && !roundsQuery.isError && visibleRounds.length === 0 && !isSearching && (
        <EmptyState
          title="No section availability rounds yet"
          description="Review a section's upcoming fixtures and open a poll covering whichever ones you select."
        />
      )}
    </Box>
  )
}
