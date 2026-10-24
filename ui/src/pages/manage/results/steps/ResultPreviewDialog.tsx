import { Alert, Box, Dialog, DialogContent, DialogTitle, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../../../components/Button'
import type { Match } from '../../../../api/matchApi'
import { getMatchResult, resultKeys } from '../../../../api/matchResultApi'
import { listTeamsForClub } from '../../../../api/teamApi'
import { isNotFound } from '../../../../utils/errorDetail'
import { ResultBody } from '../ResultBody'

export interface ResultPreviewDialogProps {
  open: boolean
  onClose: () => void
  clubId: string
  match: Match
}

export const PREVIEW_BANNER = 'Preview: not published yet. This is how the result will look once published.'

function Body({ clubId, match }: Pick<ResultPreviewDialogProps, 'clubId' | 'match'>) {
  // Read afresh: the wizard has just saved the draft, and what is shown is what the server holds.
  const resultQuery = useQuery({
    queryKey: resultKeys.detail(clubId, match.id),
    queryFn: async () => {
      try {
        return await getMatchResult(clubId, match.id)
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const teamsQuery = useQuery({ queryKey: ['managed-club', clubId, 'teams'], queryFn: () => listTeamsForClub(clubId) })

  if (resultQuery.isPending || teamsQuery.isPending) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading the preview…
      </Typography>
    )
  }
  if (resultQuery.isError || teamsQuery.isError) {
    return (
      <Alert severity="error" role="alert">
        We couldn&apos;t load the preview. Please try again.
      </Alert>
    )
  }
  if (!resultQuery.data) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nothing has been entered yet, so there is nothing to preview.
      </Typography>
    )
  }
  const teamsById = new Map(teamsQuery.data.map((team) => [team.id, team]))
  return <ResultBody clubId={clubId} match={match} result={resultQuery.data} teamsById={teamsById} readOnly />
}

// docs/specs/104-match-results-import-adaptors.md (the capture wizard's Review step): the saved draft drawn by the same
// ResultBody the published result page uses, full screen, so a manager can compare it with the Review summary. Guesses and
// unconfirmed names show as they do on that page. Nothing here publishes or changes the result.
export function ResultPreviewDialog({ open, onClose, clubId, match }: ResultPreviewDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: { xs: 2, sm: 3 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <DialogTitle sx={{ p: 0 }}>Result preview</DialogTitle>
        <Button size="compact" variant="secondary" onClick={onClose} sx={{ flex: 'none' }}>
          Back to review
        </Button>
      </Box>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, bgcolor: 'background.default' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2 }, maxWidth: 1100, mx: 'auto', pt: 1 }}>
          <Alert severity="warning" role="status" data-testid="preview-banner" sx={{ fontWeight: 600 }}>
            {PREVIEW_BANNER}
          </Alert>
          {open && <Body clubId={clubId} match={match} />}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
