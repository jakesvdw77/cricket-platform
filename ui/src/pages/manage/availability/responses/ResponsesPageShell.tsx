import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, InputAdornment, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { Input } from '../../../../components/Input'
import { ManageScreenHeader } from '../../../../components/ManageScreenHeader'
import type { SectionAvailabilityRoundBracket, SectionAvailabilityRoundMatch } from '../../../../api/sectionAvailabilityApi'
import { filterPlayers, groupBySlot } from './responseHelpers'
import type { OverrideProps, ResponseRow } from './responseHelpers'
import { ResponsesByTimeSlot } from './ResponsesByTimeSlot'
import { ResponsesByPlayer } from './ResponsesByPlayer'
import { ResponsesSummary } from './ResponsesSummary'

type View = 'slot' | 'player' | 'summary'

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
  // Neither the view nor the search is persisted: a fresh visit starts on By time slot.
  const [view, setView] = useState<View>('slot')
  const [search, setSearch] = useState('')

  const filteredRows = useMemo(() => filterPlayers(responses.rows, search), [responses.rows, search])
  const slots = useMemo(
    () => groupBySlot({ brackets: responses.brackets, responses: filteredRows }, matches),
    [responses.brackets, filteredRows, matches],
  )
  // Summary always shows the full totals, whatever the search says.
  const summarySlots = useMemo(
    () => groupBySlot({ brackets: responses.brackets, responses: responses.rows }, matches),
    [responses.brackets, responses.rows, matches],
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <ManageScreenHeader title={title} backTo={backTo} backLabel={backLabel} action={headerAction} />

      {meta}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <ToggleButtonGroup
          value={view}
          exclusive
          size="small"
          aria-label="Responses view"
          sx={{
            flex: 'none',
            alignSelf: { xs: 'stretch', sm: 'center' },
            '& .MuiToggleButton-root': { flex: { xs: 1, sm: 'none' }, px: 2, whiteSpace: 'nowrap' },
            // The selected view is the green fill (primary main + white text), not MUI's faint grey.
            '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderColor: 'primary.main',
              fontWeight: 600,
            },
            '& .MuiToggleButton-root.Mui-selected:hover': { bgcolor: 'primary.dark' },
          }}
          onChange={(_event, next: View | null) => next && setView(next)}
        >
          <ToggleButton value="slot">Time slot</ToggleButton>
          <ToggleButton value="player">Player</ToggleButton>
          <ToggleButton value="summary">Summary</ToggleButton>
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

      {view === 'slot' && <ResponsesByTimeSlot slots={slots} override={override} />}
      {view === 'player' && responses.rows.length > 0 && (
        <ResponsesByPlayer rows={filteredRows} brackets={slots.map((slot) => slot.bracket)} override={override} />
      )}
      {view === 'summary' && <ResponsesSummary slots={summarySlots} />}

      {children}
    </Box>
  )
}
