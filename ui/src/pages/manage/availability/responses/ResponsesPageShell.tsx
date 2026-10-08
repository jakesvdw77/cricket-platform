import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Theme } from '@mui/material'
import { Box, InputAdornment, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '../../../../hooks/useDocumentTitle'
import { Input } from '../../../../components/Input'
import { ResponseGauge } from '../../../../components/ResponseGauge'
import { compactFieldsSx, compactFilterPanelSx } from '../../../../utils/filterPanel'
import { segmentedSwitchSx } from '../../../../utils/segmentedSwitch'
import { ManageScreenHeader } from '../../../../components/ManageScreenHeader'
import type { SectionAvailabilityRoundBracket, SectionAvailabilityRoundMatch } from '../../../../api/sectionAvailabilityApi'
import { answeredCoverage, filterPlayers, groupBySlot } from './responseHelpers'
import type { OverrideProps, ResponseRow } from './responseHelpers'
import { ResponsesByTimeSlot } from './ResponsesByTimeSlot'
import { ResponsesByPlayer } from './ResponsesByPlayer'

type View = 'slot' | 'player'

// docs/specs/076-team-selection.md: the selection dialog's 'Change answer' link carries a returnTo
// query parameter. Only a same-app relative path under /manage/ is honoured (anything else, such as
// an absolute URL or a protocol-relative '//host', is ignored to avoid an open redirect).
export function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith('/manage/') || value.startsWith('//') || value.includes('\\')) {
    return null
  }
  return value
}

export interface ResponsesPageShellProps {
  title: string
  backTo: string
  backLabel: string
  // The header's top-right action(s), e.g. Share invite.
  headerAction?: ReactNode
  // A row of poll details under the header, supplied by each page so its own header DOM is kept.
  meta?: ReactNode
  open: boolean
  responses: { brackets: SectionAvailabilityRoundBracket[]; rows: ResponseRow[] }
  matches: SectionAvailabilityRoundMatch[]
  override: OverrideProps
  overrideError?: string | null
  emptyText: string
  // Dialogs and other page-owned extras, rendered last.
  children?: ReactNode
}

// docs/specs/065 + 067: the generic part of a poll's Responses page (view switch, search, closed
// note, override error, the three views), shared by the group and the squad poll pages. A squad
// poll arrives as one synthetic bracket, so no view or helper knows the difference.
export function ResponsesPageShell({
  title,
  backTo,
  backLabel,
  headerAction,
  meta,
  open,
  responses,
  matches,
  override,
  overrideError,
  emptyText,
  children,
}: ResponsesPageShellProps) {
  // docs/specs/085 (C8): the browser tab names the poll.
  useDocumentTitle(title)
  // Neither the view nor the search is persisted: a fresh visit starts on By time slot.
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('returnTo'))
  const [view, setView] = useState<View>('slot')
  const [search, setSearch] = useState('')

  const filteredRows = useMemo(() => filterPlayers(responses.rows, search), [responses.rows, search])
  const slots = useMemo(
    () => groupBySlot({ brackets: responses.brackets, responses: filteredRows }, matches),
    [responses.brackets, filteredRows, matches],
  )
  // The header gauge counts everyone, whatever the search says (unfiltered rows). Several slots: how many players
  // answered all / some / none of them. One slot (or a squad poll, which arrives as one): the four-status split from
  // the slot's own totals.
  const multiSlot = responses.brackets.length > 1
  const coverage = useMemo(() => answeredCoverage(responses.rows, responses.brackets), [responses.rows, responses.brackets])
  const single = responses.brackets[0]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <ManageScreenHeader
        title={title}
        backTo={returnTo ?? backTo}
        backLabel={returnTo ? 'Back to team selection' : backLabel}
        action={headerAction}
      />

      {(meta || single) && (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: { sm: 'wrap' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>{meta}</Box>
          {single && (
            <Box sx={{ ml: { sm: 'auto' }, flex: '0 0 auto', maxWidth: '100%' }}>
              {multiSlot ? (
                <ResponseGauge mode="poll" coverage={coverage} />
              ) : (
                <ResponseGauge
                  mode="status"
                  counts={{
                    available: single.availableCount,
                    unsure: single.unsureCount,
                    unavailable: single.unavailableCount,
                    noResponse: single.noResponseCount,
                  }}
                />
              )}
            </Box>
          )}
        </Box>
      )}

      <Box sx={[compactFilterPanelSx as object, (theme: Theme) => ({ [theme.breakpoints.up('sm')]: compactFieldsSx })]}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <ToggleButtonGroup
            value={view}
            exclusive
            size="small"
            aria-label="Responses view"
            sx={segmentedSwitchSx}
            onChange={(_event, next: View | null) => next && setView(next)}
          >
            <ToggleButton value="slot">Time slot</ToggleButton>
            <ToggleButton value="player">Player</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ flex: { sm: '1 1 0' }, minWidth: 0, width: { xs: '100%', sm: 'auto' } }}>
            <Input
              label="Search players"
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
        </Stack>
      </Box>

      {!open && (
        <Typography variant="body2" color="text.secondary">
          This poll is closed. Changes are recorded as a manager correction.
        </Typography>
      )}
      {overrideError && (
        <Typography variant="body2" color="error.main" role="alert">
          {overrideError}
        </Typography>
      )}

      {responses.rows.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {emptyText}
        </Typography>
      )}

      {view === 'slot' && <ResponsesByTimeSlot slots={slots} override={override} slotBars={multiSlot} />}
      {view === 'player' && responses.rows.length > 0 && (
        <ResponsesByPlayer rows={filteredRows} allRows={responses.rows} brackets={slots.map((slot) => slot.bracket)} override={override} />
      )}

      {children}
    </Box>
  )
}
