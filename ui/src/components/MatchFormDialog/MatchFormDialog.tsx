import { Box, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { Button } from '../Button'
import { MatchForm, MATCH_FORM_ID } from '../MatchForm'
import { useCreateMatch, useMatchFormData } from '../../hooks/useMatchFormData'
import type { Match, MatchPayload } from '../../api/matchApi'
import type { Season } from '../../api/seasonApi'
import { toDatetimeLocal } from '../../utils/datetimeLocal'
import { errorDetail } from '../../utils/errorDetail'

export interface MatchFormDialogProps {
  open: boolean
  onClose: () => void
  clubId: string
  // Called with the saved match, after the matches lists were refreshed; the dialog closes itself right after.
  onCreated: (match: Match) => void
  // What the form opens with (MatchForm's own initialValues), for a caller that can suggest some of it.
  initialValues?: Partial<MatchPayload>
  // With a suggested match date and no season, preselect the season whose dates contain it, when exactly one does.
  inferSeason?: boolean
  // A line under the title, e.g. what the values were suggested from.
  hint?: string
}

// Never guesses between seasons: only a single season that contains the date is chosen.
function withInferredSeason(values: Partial<MatchPayload> | undefined, seasons: Season[]): Partial<MatchPayload> | undefined {
  if (!values?.matchDate || values.seasonId) return values
  const day = toDatetimeLocal(values.matchDate).slice(0, 10)
  const containing = seasons.filter((season) => season.startDate <= day && day <= season.endDate)
  return containing.length === 1 ? { ...values, seasonId: containing[0].id } : values
}

function DialogBody({ clubId, onClose, onCreated, initialValues, inferSeason, hint, phone }: Omit<MatchFormDialogProps, 'open'> & { phone: boolean }) {
  const { formProps, loading } = useMatchFormData(clubId)
  const create = useCreateMatch(clubId, (match) => {
    onCreated(match)
    onClose()
  })

  const values = withInferredSeason(initialValues, inferSeason ? formProps.seasons : [])

  return (
    <>
      <DialogContent sx={{ pt: 1, px: { xs: 2, sm: 3 } }}>
        {hint && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {hint}
          </Typography>
        )}
        {/* MatchForm renders into its parent's grid (display: contents), as RecordFormScreen provides on the page. */}
        {loading ? (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2 }}>
            <MatchForm clubId={clubId} initialValues={values} {...formProps} onSubmit={(payload) => create.mutate(payload)} />
          </Box>
        )}
        {create.isError && (
          <Typography variant="body2" color="error.main" sx={{ mt: 2 }}>
            {errorDetail(create.error, 'Something went wrong saving this match. Please try again.')}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, gap: 1.5, borderTop: 1, borderColor: 'divider', ...(phone ? { '& > *': { flex: 1 } } : {}) }}>
        <Button variant="secondary" onClick={onClose} disabled={create.isPending} sx={{ minHeight: 44 }}>
          Cancel
        </Button>
        <Button type="submit" form={MATCH_FORM_ID} disabled={create.isPending || loading} sx={{ minHeight: 44 }}>
          {create.isPending ? 'Saving…' : 'Create match'}
        </Button>
      </DialogActions>
    </>
  )
}

// Add a match without leaving the page you are on (the import wizard's "Match not listed? Add the match first"). The same
// MatchForm and create call as the Add Match page, in a dialog on a desktop and a full-screen dialog on a phone, with Cancel
// and Create match in the footer. The caller gets the saved match through onCreated and everything behind the dialog is left
// exactly as it was.
export function MatchFormDialog({ open, onClose, clubId, onCreated, initialValues, inferSeason, hint }: MatchFormDialogProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={phone} aria-label="Add a match">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: { xs: 2, sm: 3 } }}>
        Add a match
        {phone && (
          <IconButton aria-label="Close" onClick={onClose} sx={{ width: 44, height: 44 }}>
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      {open && <DialogBody clubId={clubId} onClose={onClose} onCreated={onCreated} initialValues={initialValues} inferSeason={inferSeason} hint={hint} phone={phone} />}
    </Dialog>
  )
}
