import { Alert, Box, ButtonBase, MenuItem, Select, Skeleton, Typography } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { useMyClosedPolls, useMyPollResponses } from '../../../api/meAvailabilityApi'
import type { MyPollHistoryRow, MyPollStatusFilter } from '../../../api/meAvailabilityApi'
import { useMyPlayerPolls } from '../../../api/myPlayersApi'
import { STATS_COLOUR, STATS_TONES, creamAlpha, blackAlpha } from '../../../brandTokens'
import { formatDateTime } from '../../../utils/publicAvailabilityFormat'
import { HubPageHeader } from './HubPageHeader'
import { HubPillStrip } from './HubPillStrip'
import type { HubPillItem } from './HubPillStrip'
import { MyPlayerPolls } from './MyPlayerPolls'
import { HUB, darkFieldSx, darkMenuProps } from './hubStyle'
import { shortDate } from './leagueFormat'

// docs/specs/119 (Hub Availability sub-menus, mockup player-hub-availability-pills-round1): a pill row under the title. Open Polls
// (the default, where the player answers), Closed Polls (closed in the last 30 days, read only) and My Responses (the current
// season's polls, answered or not, with a Season dropdown). The pill is kept in the URL (`?tab=open|closed|responses`, replace), the
// status chips in `?status=` and the dropdown in `?season=`. Every figure and every state comes from the server.
const TABS = ['open', 'closed', 'responses'] as const
type AvailabilityTab = (typeof TABS)[number]
const SINCE_DAYS = 30
const STATUS_CHIPS: Array<{ id: '' | MyPollStatusFilter; label: string }> = [
  { id: '', label: 'All' },
  { id: 'AVAILABLE', label: 'Available' },
  { id: 'UNAVAILABLE', label: 'Unavailable' },
  { id: 'UNSURE', label: 'Not Sure' },
  { id: 'NOT_ANSWERED', label: 'Not Answered' },
]
const column = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5, minWidth: 0 } as const

const ANSWER_LOOK: Record<string, { label: string; colour: string }> = {
  AVAILABLE: { label: 'Available', colour: STATS_COLOUR.good },
  UNAVAILABLE: { label: 'Unavailable', colour: STATS_COLOUR.bad },
  UNSURE: { label: 'Not Sure', colour: STATS_COLOUR.amber },
  NOT_ANSWERED: { label: 'Not Answered', colour: HUB.muted },
}

function Chip({ label, colour, testId }: { label: string; colour: string; testId?: string }) {
  return (
    <Box
      component="span"
      data-testid={testId}
      sx={{ display: 'inline-block', fontFamily: HUB.display, fontWeight: 700, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: '18px', px: 0.875, border: 1, borderColor: 'currentColor', borderRadius: '3px', color: colour, whiteSpace: 'nowrap' }}
    >
      {label}
    </Box>
  )
}

function titleOf(row: MyPollHistoryRow): string {
  return row.kind === 'SQUAD' && row.homeName && row.awayName ? `${row.homeName} v ${row.awayName}` : row.title
}

function dateOf(row: MyPollHistoryRow): string | null {
  if (row.matchDate) return formatDateTime(row.matchDate)
  const first = row.windowDate?.[0]
  return first ? shortDate(first) : null
}

function HistoryCard({ row, showOutcome }: { row: MyPollHistoryRow; showOutcome: boolean }) {
  const date = dateOf(row)
  const meta = [row.teamName, row.venue, row.closedAt ? `Closed ${formatDateTime(row.closedAt)}` : row.open ? 'Open' : null].filter(Boolean).join(' · ')
  const answers = row.answers.length > 0 ? row.answers : []
  return (
    <Box data-testid="history-card" sx={{ border: 1, borderColor: HUB.lineSoft, bgcolor: HUB.panelDark, borderRadius: '6px', p: { xs: 1.25, sm: 1.5 }, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.75, minWidth: 0, color: HUB.cream }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
        <Typography component="h3" sx={{ flex: '1 1 160px', minWidth: 0, fontFamily: HUB.display, fontWeight: 700, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
          {titleOf(row)}
        </Typography>
        {date && <Typography sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 13, letterSpacing: '0.1em', color: HUB.muted, textTransform: 'uppercase' }}>{date}</Typography>}
      </Box>
      {meta && <Typography sx={{ fontSize: 13, color: HUB.muted, overflowWrap: 'anywhere' }}>{meta}</Typography>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, minWidth: 0 }}>
        {answers.length === 0 && <Chip label={ANSWER_LOOK.NOT_ANSWERED.label} colour={ANSWER_LOOK.NOT_ANSWERED.colour} testId="answer-chip" />}
        {answers.map((answer, index) => {
          const look = ANSWER_LOOK[answer.status] ?? ANSWER_LOOK.NOT_ANSWERED
          return (
            <Box key={answer.windowId ?? `squad-${index}`} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0, flexWrap: 'wrap' }}>
              {row.kind === 'GROUP' && answer.label && <Typography component="span" sx={{ fontSize: 13, color: HUB.sand, overflowWrap: 'anywhere' }}>{answer.label}</Typography>}
              <Chip label={look.label} colour={look.colour} testId="answer-chip" />
            </Box>
          )
        })}
        {showOutcome && row.open && <Chip label="Open" colour={HUB.muted} testId="outcome-chip" />}
        {row.selected === true && <Chip label="Selected" colour={STATS_TONES.blue} testId="outcome-chip" />}
        {row.selected === false && <Chip label="Not Selected" colour={HUB.muted} testId="outcome-chip" />}
      </Box>
    </Box>
  )
}

function StatusChips({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <Box role="group" aria-label="Status" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <Typography component="span" sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: HUB.muted, mr: 0.5 }}>Status</Typography>
      {STATUS_CHIPS.map((chip) => {
        const on = chip.id === value
        return (
          <ButtonBase
            key={chip.id || 'all'}
            aria-pressed={on}
            onClick={() => onChange(chip.id)}
            sx={{
              position: 'relative',
              minHeight: 32,
              px: 1.5,
              borderRadius: 999,
              border: 1,
              borderColor: on ? HUB.sand : HUB.lineSoft,
              bgcolor: on ? creamAlpha(0.12) : 'transparent',
              color: on ? HUB.cream : HUB.muted,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 500,
              // A 44 px touch target around the 32 px chip.
              '&::after': { content: '""', position: 'absolute', inset: '-6px 0' },
              '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
            }}
          >
            {chip.label}
          </ButtonBase>
        )
      })}
    </Box>
  )
}

function Tile({ value, label, colour }: { value: string; label: string; colour?: string }) {
  return (
    <Box sx={{ border: 1, borderColor: HUB.lineSoft, borderRadius: '6px', bgcolor: HUB.panelDark, px: 1.25, py: 1, minWidth: 0 }}>
      <Typography component="b" sx={{ display: 'block', fontFamily: HUB.display, fontWeight: 700, fontSize: 26, lineHeight: 1, color: colour ?? HUB.cream }}>{value}</Typography>
      <Typography component="span" sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: HUB.muted, overflowWrap: 'anywhere' }}>{label}</Typography>
    </Box>
  )
}

function Loading() {
  return (
    <Box sx={column} aria-busy="true">
      {[0, 1, 2].map((n) => <Skeleton key={n} variant="rounded" height={96} sx={{ bgcolor: creamAlpha(0.12) }} />)}
    </Box>
  )
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={onRetry}>Retry</Button>}>
      We could not load the availability polls. Please try again.
    </Alert>
  )
}

function Empty({ text, testId }: { text: string; testId: string }) {
  return (
    <Box data-testid={testId} sx={{ border: 1, borderColor: HUB.line, borderStyle: 'dashed', borderRadius: '4px', p: 2.5, bgcolor: blackAlpha(0.22) }}>
      <Typography variant="body2" sx={{ color: HUB.muted }}>{text}</Typography>
    </Box>
  )
}

export function HubAvailability({ playerKey, playerName }: { playerKey: string; playerName: string }) {
  const [search, setSearch] = useSearchParams()
  const asked = search.get('tab')
  const tab: AvailabilityTab = TABS.find((candidate) => candidate === asked) ?? 'open'
  const askedStatus = search.get('status')
  const status = STATUS_CHIPS.find((chip) => chip.id && chip.id === askedStatus)?.id ?? ''
  const seasonParam = search.get('season')

  const open = useMyPlayerPolls(playerKey)
  // The pill counts and the summary tiles are the unfiltered reads; the list adds the status (the same query when no status is set).
  const closedAll = useMyClosedPolls(playerKey, { sinceDays: SINCE_DAYS })
  const closedList = useMyClosedPolls(playerKey, { sinceDays: SINCE_DAYS, status: status || null }, tab === 'closed' && Boolean(status))
  const responsesAll = useMyPollResponses(playerKey, { seasonId: seasonParam })
  const responsesList = useMyPollResponses(playerKey, { seasonId: seasonParam, status: status || null }, tab === 'responses' && Boolean(status))

  const closed = status ? closedList : closedAll
  const responses = status ? responsesList : responsesAll

  const pills: HubPillItem[] = [
    { id: 'open', label: 'Open Polls', count: open.data?.length ?? 0 },
    { id: 'closed', label: 'Closed Polls', count: closedAll.data?.total ?? 0 },
    { id: 'responses', label: 'My Responses', count: responsesAll.data?.summary.polls ?? 0 },
  ]

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(search)
    Object.entries(changes).forEach(([name, value]) => (value ? next.set(name, value) : next.delete(name)))
    setSearch(next, { replace: true })
  }

  const seasons = responsesAll.data?.seasons ?? []
  const seasonValue = seasons.some((season) => season.id === (seasonParam ?? '')) ? (seasonParam as string) : (responsesAll.data?.scope.seasonId ?? responsesAll.data?.currentSeasonId ?? '')
  const seasonSelect =
    tab === 'responses' && seasons.length > 0 ? (
      <Box sx={{ ...darkFieldSx, minWidth: { xs: 112, sm: 140 }, maxWidth: { xs: 'calc(100vw - 48px)', md: 'none' } }}>
        <Select
          size="small"
          fullWidth
          value={seasonValue}
          onChange={(event) => update({ season: event.target.value })}
          inputProps={{ 'aria-label': 'Season' }}
          MenuProps={darkMenuProps}
          sx={{ minHeight: 44, '& .MuiSelect-select': { minHeight: 44, display: 'flex', alignItems: 'center', boxSizing: 'border-box', fontFamily: HUB.display, fontSize: 18, letterSpacing: '0.06em' } }}
        >
          {seasons.map((season) => (
            <MenuItem key={season.id} value={season.id} sx={{ minHeight: 44 }}>{season.label}</MenuItem>
          ))}
        </Select>
      </Box>
    ) : undefined

  let body
  if (tab === 'open') {
    body = <MyPlayerPolls playerKey={playerKey} playerName={playerName} />
  } else if (tab === 'closed') {
    body = closed.isLoading ? (
      <Loading />
    ) : closed.isError ? (
      <Failed onRetry={() => closed.refetch()} />
    ) : (
      <Box data-testid="availability-closed" sx={column}>
        <StatusChips value={status} onChange={(next) => update({ status: next || null })} />
        {(closed.data?.rows ?? []).length === 0 ? (
          <Empty testId="closed-none" text={status ? `No closed polls with this answer in the last ${SINCE_DAYS} days` : `None closed in the last ${SINCE_DAYS} days`} />
        ) : (
          (closed.data?.rows ?? []).map((row) => <HistoryCard key={row.pollId} row={row} showOutcome={false} />)
        )}
      </Box>
    )
  } else {
    const summary = responsesAll.data?.summary
    body = responses.isLoading ? (
      <Loading />
    ) : responses.isError ? (
      <Failed onRetry={() => responses.refetch()} />
    ) : (
      <Box data-testid="availability-responses" sx={column}>
        {summary && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}>
            <Tile value={`${summary.answered}/${summary.polls}`} label="Answered" />
            <Tile value={String(summary.available)} label="Available" colour={STATS_COLOUR.good} />
            <Tile value={String(summary.unavailable)} label="Unavailable" colour={STATS_COLOUR.bad} />
            <Tile value={String(summary.notAnswered)} label="Not answered" />
          </Box>
        )}
        <StatusChips value={status} onChange={(next) => update({ status: next || null })} />
        {(responses.data?.rows ?? []).length === 0 ? (
          <Empty testId="responses-none" text={status ? 'No polls with this answer this season' : `No availability polls this season for ${playerName}`} />
        ) : (
          (responses.data?.rows ?? []).map((row) => <HistoryCard key={row.pollId} row={row} showOutcome />)
        )}
      </Box>
    )
  }

  return (
    <Box sx={column}>
      <HubPageHeader title="Availability" actions={seasonSelect} />
      <HubPillStrip compact label="Availability" items={pills} selectedId={tab} onSelect={(item) => update({ tab: item.id, status: null })} />
      {body}
    </Box>
  )
}
