import { useMemo, useState } from 'react'
import { Alert, Box, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, ToggleButton, Tooltip, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { useTeamSelection } from '../../../api/teamSelectionApi'
import type { TeamSelectionOverview } from '../../../api/teamSelectionApi'
import { Button } from '../../../components/Button'
import { CompactToggleGroup } from '../../../components/CompactToggleGroup'
import { EmptyState } from '../../../components/EmptyState'
import { analyseSelection } from './selectionAnalysis'
import type { AnalysisRow } from './selectionAnalysis'
import type { TeamSelectionHubContext } from './hubContext'

type Scope = 'view' | 'season'
type Counting = 'all' | 'announced'

const PLAYING = 'primary.main'
const TWELFTH = (theme: { palette: { primary: { light: string } } }) =>
  `repeating-linear-gradient(45deg, ${theme.palette.primary.light} 0 4px, transparent 4px 8px)`

// "J. van der Westhuizen" on a phone, the full name otherwise.
function shortName(name: string): string {
  const [first, ...rest] = name.split(' ')
  return rest.length > 0 ? `${first.charAt(0)}. ${rest.join(' ')}` : name
}

function PlayerBar({ row, scale, average, phone }: { row: AnalysisRow; scale: number; average: number; phone: boolean }) {
  const hot = row.tag === 'ABOVE_AVERAGE'
  const cold = row.tag === 'NOT_PICKED'
  const label = `${row.name}: ${row.total} of ${row.available} games${row.twelfth > 0 ? `, ${row.twelfth} as 12th man` : ''}`
  return (
    <Box
      data-testid="analysis-row"
      sx={{ display: 'grid', gridTemplateColumns: { xs: '112px 1fr 54px', sm: '190px 1fr 76px' }, gap: 1, alignItems: 'center', py: 0.5 }}
    >
      <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: hot ? 'warning.dark' : cold ? 'text.secondary' : 'text.primary' }} title={row.name}>
        {phone ? shortName(row.name) : row.name}
      </Typography>
      <Box role="img" aria-label={label} sx={{ position: 'relative', height: 16, borderRadius: 0.5, bgcolor: 'action.hover', display: 'flex', overflow: 'visible' }}>
        {cold && <Box data-testid="not-picked-block" sx={{ width: 28, border: 1, borderStyle: 'dashed', borderColor: 'text.disabled', borderRadius: 0.5 }} />}
        <Box sx={{ width: `${(row.playing / scale) * 100}%`, bgcolor: hot ? 'warning.main' : PLAYING, borderRadius: '2px 0 0 2px' }} />
        <Box sx={{ width: `${(row.twelfth / scale) * 100}%`, backgroundImage: TWELFTH }} />
        <Box sx={{ position: 'absolute', top: -3, bottom: -3, left: `${(average / scale) * 100}%`, width: 2, bgcolor: 'secondary.main' }} />
      </Box>
      <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {row.total}{' '}
        <Typography component="span" variant="caption" color="text.secondary">
          {phone ? `/${row.available}` : `of ${row.available}`}
        </Typography>
      </Typography>
    </Box>
  )
}

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.5 }}>
      <Typography component="span" sx={{ fontWeight: 700, fontSize: 20, mr: 0.75 }}>{value}</Typography>
      <Typography component="span" variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
    </Box>
  )
}

// docs/specs/156-selection-analysis.md: a horizontal bar per player for how many of the games they were picked for. Read only.
// It counts what the page's own filters select (League, Section, Team, and View Entire Season); Whole Season ignores the
// View Entire Season switch and reads every match of the season.
export function SelectionAnalysisDialog({ hub, open, onClose }: { hub: TeamSelectionHubContext; open: boolean; onClose: () => void }) {
  const { clubId, overview, filters, seasonId, scopeText } = hub
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'), { noSsr: true })
  const [scope, setScope] = useState<Scope>('view')
  const [counting, setCounting] = useState<Counting>('all')
  const seasonQuery = useTeamSelection(
    clubId,
    { seasonId, leagueId: filters.leagueId, sectionId: filters.sectionId, teamId: filters.teamId, includePast: true },
    open && scope === 'season',
  )
  const source = scope === 'season' ? seasonQuery : overview
  const data: TeamSelectionOverview | undefined = source.data
  const analysis = useMemo(() => (data ? analyseSelection(data, { announcedOnly: counting === 'announced' }) : null), [data, counting])

  return (
    <Dialog open={open} onClose={onClose} fullScreen={phone} fullWidth maxWidth="md" aria-labelledby="selection-analysis-title">
      <DialogTitle id="selection-analysis-title" sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, pr: 1 }}>
        <Box>
          Selection Analysis
          <Typography variant="body2" color="text.secondary" component="div">
            {[scopeText(), analysis ? `${analysis.games} ${analysis.games === 1 ? 'game' : 'games'}` : null].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          <CompactToggleGroup<Scope> value={scope} onChange={setScope} ariaLabel="Games to count">
            <ToggleButton value="view" aria-label="Games In View">Games In View</ToggleButton>
            <ToggleButton value="season" aria-label="Whole Season">Whole Season</ToggleButton>
          </CompactToggleGroup>
          <CompactToggleGroup<Counting> value={counting} onChange={setCounting} ariaLabel="Selections to count">
            <ToggleButton value="all" aria-label="All Selections">All Selections</ToggleButton>
            <ToggleButton value="announced" aria-label="Announced Only">Announced Only</ToggleButton>
          </CompactToggleGroup>
        </Box>
        {source.isPending && source.fetchStatus !== 'idle' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress aria-label="Loading analysis" /></Box>
        )}
        {source.isError && <Alert severity="error">The analysis could not be loaded. Please try again.</Alert>}
        {data?.truncated && <Alert severity="info" sx={{ mb: 1 }}>Only the first matches are counted. Narrow the filters to count the rest.</Alert>}
        {analysis && analysis.rows.length === 0 && <EmptyState title="No players" description="There are no players for these filters." />}
        {analysis && analysis.rows.length > 0 && (
          <>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              <Figure value={analysis.rows.length} label="Players" />
              <Figure value={analysis.average.toFixed(1)} label="Average Picks" />
              <Figure value={analysis.notPicked} label="Not Picked Yet" />
            </Box>
            <Box data-testid="analysis-list">
              {analysis.rows.map((row) => (
                <PlayerBar key={row.playerId} row={row} scale={analysis.scale} average={analysis.average} phone={phone} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary"><Box component="i" sx={{ display: 'inline-block', width: 12, height: 12, bgcolor: PLAYING, borderRadius: 0.5, mr: 0.75, verticalAlign: '-2px' }} />Playing</Typography>
              <Typography variant="caption" color="text.secondary"><Box component="i" sx={{ display: 'inline-block', width: 12, height: 12, backgroundImage: TWELFTH, borderRadius: 0.5, mr: 0.75, verticalAlign: '-2px' }} />12th man</Typography>
              <Typography variant="caption" color="text.secondary"><Box component="i" sx={{ display: 'inline-block', width: 12, height: 12, bgcolor: 'warning.main', borderRadius: 0.5, mr: 0.75, verticalAlign: '-2px' }} />Above average</Typography>
              <Typography variant="caption" color="text.secondary"><Box component="i" sx={{ display: 'inline-block', width: 12, height: 12, border: 1, borderStyle: 'dashed', borderColor: 'text.disabled', borderRadius: 0.5, mr: 0.75, verticalAlign: '-2px' }} />Not picked</Typography>
              <Typography variant="caption" color="text.secondary"><Box component="i" sx={{ display: 'inline-block', width: 3, height: 12, bgcolor: 'secondary.main', mr: 0.75, verticalAlign: '-2px' }} />Average</Typography>
              <Tooltip title="The number after each count is the games the player said they were available for, or was picked for.">
                <Typography variant="caption" color="text.secondary">&ldquo;of 4&rdquo; = games available for</Typography>
              </Tooltip>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
