import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  Box,
  ButtonBase,
  Drawer,
  IconButton,
  InputAdornment,
  Link,
  Skeleton,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SearchIcon from '@mui/icons-material/Search'
import { BottomSheet } from '../../../../components/BottomSheet'
import { Button } from '../../../../components/Button'
import { Input } from '../../../../components/Input'
import {
  availabilitySummaryPlayersKey,
  listAvailabilitySummaryPlayers,
} from '../../../../api/availabilitySummaryApi'
import type {
  AvailabilitySummaryFilters,
  AvailabilitySummaryPlayer,
  AvailabilitySummaryPlayerPoll,
} from '../../../../api/availabilitySummaryApi'
import { groupPollResponsesPath, squadPollResponsesPath } from '../../../../utils/pollRoutes'

export type PlayersPanelTab = 'responded' | 'awaiting'

export interface PlayersPanelProps {
  open: boolean
  onClose: () => void
  clubId: string
  // The tab shown; the panel does not own it (the hub layout does, so a counter can pre-select it).
  tab: PlayersPanelTab
  onTabChange: (tab: PlayersPanelTab) => void
  // Exactly what the summary was asked, plus the 48-hour flag.
  filters: AvailabilitySummaryFilters & { closingSoon?: boolean }
  // The two counter figures, shown on the tabs.
  counts: { responded: number; awaiting: number }
  // The "Showing: ..." text of the page (empty = no shared filter set).
  scope: string
}

const SEARCH_DEBOUNCE_MS = 300
const SKELETON_ROWS = 4

function pollPath(poll: AvailabilitySummaryPlayerPoll): string {
  return poll.kind === 'SQUAD' && poll.matchId ? squadPollResponsesPath(poll.matchId, poll.id) : groupPollResponsesPath(poll.id)
}

const pollsWord = (count: number) => `${count} ${count === 1 ? 'poll' : 'polls'}`

function PollLinks({ player }: { player: AvailabilitySummaryPlayer }) {
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column' }}>
      {player.polls.map((poll) => (
        <li key={`${poll.kind}-${poll.id}`}>
          <Link
            component={RouterLink}
            to={pollPath(poll)}
            underline="hover"
            sx={{ display: 'flex', alignItems: 'center', minHeight: { xs: 44, sm: 32 }, fontSize: '0.85rem', fontWeight: 600 }}
          >
            {poll.title}
          </Link>
        </li>
      ))}
    </Box>
  )
}

// One player: name and poll count; the poll links sit beneath the name on a phone, and expand on demand on desktop.
function PlayerRow({ player, isPhone }: { player: AvailabilitySummaryPlayer; isPhone: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const linksId = `players-polls-${player.playerProfileId}`
  const header = (
    <>
      <Typography component="span" sx={{ fontWeight: 600, flex: 1, minWidth: 0, textAlign: 'left' }}>
        {player.displayName}
      </Typography>
      <Typography component="span" variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {pollsWord(player.polls.length)}
      </Typography>
    </>
  )
  return (
    <Box component="li" sx={{ borderBottom: 1, borderColor: 'divider', py: 0.5 }} data-testid="players-panel-row">
      {isPhone ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 44 }}>{header}</Box>
          <PollLinks player={player} />
        </>
      ) : (
        <>
          <ButtonBase
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={linksId}
            aria-label={`${player.displayName}, ${pollsWord(player.polls.length)}`}
            sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1, minHeight: 44, textAlign: 'left', borderRadius: 1, px: 0.5 }}
          >
            {header}
            <ExpandMoreIcon fontSize="small" sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </ButtonBase>
          {expanded && (
            <Box id={linksId} sx={{ pl: 0.5, pb: 0.5 }}>
              <PollLinks player={player} />
            </Box>
          )}
        </>
      )}
    </Box>
  )
}

interface ContentProps extends Omit<PlayersPanelProps, 'open' | 'onClose'> {
  isPhone: boolean
  // Held by PlayersPanel so it survives the sheet <-> drawer swap when the window crosses the sm breakpoint.
  searchText: string
  onSearchTextChange: (value: string) => void
}

// Mounted only while the panel is open, so the search and the expanded rows start fresh each time.
function PanelContent({ clubId, tab, onTabChange, filters, counts, scope, isPhone, searchText, onSearchTextChange }: ContentProps) {
  const [search, setSearch] = useState(searchText.trim())
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchText])

  const queryFilters = { ...filters, kind: tab, search }
  const query = useInfiniteQuery({
    queryKey: availabilitySummaryPlayersKey(clubId, queryFilters),
    queryFn: ({ pageParam }) => listAvailabilitySummaryPlayers(clubId, queryFilters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.number + 1 < last.totalPages ? last.number + 1 : undefined),
  })
  const players = query.data?.pages.flatMap((page) => page.content) ?? []

  // The tab figures are the page counters, which the 48-hour filter does not change; the list is narrowed by it,
  // so the scope line says so.
  const scopeLine = [scope, filters.closingSoon ? 'closing within 48 hours' : ''].filter(Boolean).join(' · ')

  const emptyText =
    search !== ''
      ? `No players match "${search}".`
      : tab === 'awaiting'
        ? 'Everyone has answered.'
        : 'No answers yet.'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, flex: 1 }}>
      <Tabs
        value={tab}
        onChange={(_event: SyntheticEvent, value: PlayersPanelTab) => onTabChange(value)}
        variant="fullWidth"
        aria-label="Players list"
      >
        <Tab value="responded" label={`Responded · ${counts.responded}`} id="players-tab-responded" aria-controls="players-tabpanel" />
        <Tab value="awaiting" label={`Still to answer · ${counts.awaiting}`} id="players-tab-awaiting" aria-controls="players-tabpanel" />
      </Tabs>
      <Input
        label="Search players"
        placeholder="Search by name"
        value={searchText}
        onChange={(event) => onSearchTextChange(event.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
      />
      <Box
        id="players-tabpanel"
        role="tabpanel"
        aria-labelledby={`players-tab-${tab}`}
        aria-busy={query.isPending}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
      >
        {query.isPending && (
          <Box data-testid="players-panel-loading" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <Skeleton key={index} variant="rounded" height={44} />
            ))}
          </Box>
        )}
        {query.isError && (
          <Box role="alert" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, py: 1 }}>
            <Typography>We couldn&apos;t load the players.</Typography>
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              Retry
            </Button>
          </Box>
        )}
        {query.isSuccess && players.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 1 }}>
            {emptyText}
          </Typography>
        )}
        {query.isSuccess && players.length > 0 && (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {players.map((player) => (
              <PlayerRow key={player.playerProfileId} player={player} isPhone={isPhone} />
            ))}
          </Box>
        )}
        {query.hasNextPage && (
          <Button variant="secondary" size="sm" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} sx={{ mt: 1.5 }}>
            Show more
          </Button>
        )}
      </Box>
      {scopeLine && (
        <Typography variant="caption" color="text.secondary" data-testid="players-panel-scope">
          {`Showing: ${scopeLine}`}
        </Typography>
      )}
    </Box>
  )
}

const TITLE = 'Players'

// docs/specs/084: the panel behind the two players counters on the Polls page - a bottom sheet on a phone, a right
// drawer from sm up. Two tabs (Responded / Still to answer, pre-selected by the clicked counter), a debounced name
// search, one row per player with the polls they answered or still owe (each a link to that poll's Responses page),
// and the page's own "Showing: ..." scope. Loads its own pages (25 at a time); a failure stays inside the panel.
// Closing returns focus to the counter that opened it (the Modal's default).
export function PlayersPanel({ open, onClose: close, ...content }: PlayersPanelProps) {
  const theme = useTheme()
  const [searchText, setSearchText] = useState('')
  const onClose = () => {
    setSearchText('')
    close()
  }
  const shared = { searchText, onSearchTextChange: setSearchText }
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })

  if (isPhone) {
    return (
      <BottomSheet open={open} onOpen={() => undefined} onClose={onClose} ariaLabel={TITLE} title={TITLE} closeLabel="Close players list">
        {open && <PanelContent {...content} {...shared} isPhone />}
      </BottomSheet>
    )
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ 'aria-label': TITLE, sx: { width: 420, maxWidth: '100vw', p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 } }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="h2" fontWeight={700}>
          {TITLE}
        </Typography>
        <IconButton aria-label="Close players list" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <PanelContent {...content} {...shared} isPhone={false} />
    </Drawer>
  )
}
