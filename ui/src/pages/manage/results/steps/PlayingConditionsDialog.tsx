import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useQuery } from '@tanstack/react-query'
import { getPlayingConditions } from '../../../../api/leaguePlayingConditionsApi'
import { listLeagues } from '../../../../api/leagueApi'
import { listSeasons } from '../../../../api/seasonApi'
import { Button } from '../../../../components/Button'
import { PlayingConditionsSummary } from '../../../../components/PlayingConditionsSummary'

export interface PlayingConditionsDialogProps {
  open: boolean
  onClose: () => void
  clubId: string
  leagueId: string
  seasonId: string
  // The overs of the result being reviewed (scheduled balls over balls per over); null when not set.
  scheduledOvers: number | null
}

// The league's edit page on its Conditions tab. Opened in a new tab: the capture wizard's draft is kept as it is.
const leagueConditionsPath = (leagueId: string) => `/manage/fixtures/leagues/${leagueId}/edit?tab=conditions`

function Body({ clubId, leagueId, seasonId, scheduledOvers, onClose, phone }: Omit<PlayingConditionsDialogProps, 'open'> & { phone: boolean }) {
  const conditionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'playing-conditions', leagueId, seasonId],
    queryFn: () => getPlayingConditions(clubId, leagueId, seasonId),
    staleTime: Infinity,
  })
  const leaguesQuery = useQuery({ queryKey: ['managed-club', clubId, 'leagues'], queryFn: () => listLeagues(clubId) })
  const seasonsQuery = useQuery({ queryKey: ['managed-club', clubId, 'seasons'], queryFn: () => listSeasons(clubId) })

  const leagueName = leaguesQuery.data?.find((league) => league.id === leagueId)?.name ?? 'This match’s league'
  const seasonLabel = seasonsQuery.data?.find((season) => season.id === seasonId)?.label ?? null
  const loading = conditionsQuery.isPending

  return (
    <>
      <DialogContent sx={{ pt: 1, px: { xs: 2, sm: 3 } }}>
        {loading ? (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        ) : conditionsQuery.isError ? (
          <Typography variant="body2" color="error.main" role="alert">
            We couldn&apos;t load the playing conditions. Please try again.
          </Typography>
        ) : (
          <PlayingConditionsSummary leagueName={leagueName} seasonLabel={seasonLabel} conditions={conditionsQuery.data ?? null} scheduledOvers={scheduledOvers} />
        )}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, gap: 1.5, borderTop: 1, borderColor: 'divider', ...(phone ? { flexDirection: 'column', alignItems: 'stretch', '& > :not(style)': { m: 0 } } : {}) }}>
        <Button
          variant="secondary"
          onClick={() => window.open(leagueConditionsPath(leagueId), '_blank', 'noopener')}
          endIcon={<OpenInNewIcon fontSize="small" />}
          sx={{ minHeight: 44 }}
        >
          Open the league&apos;s conditions
        </Button>
        <Button onClick={onClose} sx={{ minHeight: 44 }}>
          Close
        </Button>
      </DialogActions>
    </>
  )
}

// docs/specs/104-match-results-import-adaptors.md (the capture wizard's Review step): which rules the league plays by, read
// only, beside the Checks that may say a bowler went over the league's maximum. A dialog on a desktop, full screen on a phone.
export function PlayingConditionsDialog({ open, onClose, ...rest }: PlayingConditionsDialogProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={phone} aria-label="Playing conditions">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: { xs: 2, sm: 3 } }}>
        Playing conditions
        <IconButton aria-label="Close dialog" onClick={onClose} sx={{ width: 44, height: 44, display: phone ? 'inline-flex' : 'none' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      {open && <Body {...rest} onClose={onClose} phone={phone} />}
    </Dialog>
  )
}
