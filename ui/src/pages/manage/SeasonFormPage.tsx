import { Stack, Typography } from '@mui/material'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SeasonForm, SEASON_FORM_ID } from '../../components/SeasonForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { listSeasons, createSeason, updateSeason } from '../../api/seasonApi'
import type { SeasonPayload } from '../../api/seasonApi'
import { errorDetail } from '../../utils/errorDetail'

// clubId comes from ManagerHome's Outlet context, seasonId is a route param — same shape as
// SponsorFormPage.tsx. There's no single-season GET endpoint (only list/create/update/
// deactivate/reactivate, per docs/specs/029-league-management.md's API Contract) — edit mode
// fetches the full (small, unpaginated) list and finds the matching row client-side.
export default function SeasonFormPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { seasonId } = useParams<{ seasonId?: string }>()
  const isEdit = Boolean(seasonId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data: season,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId) && isEdit,
    select: (seasons) => seasons.find((candidate) => candidate.id === seasonId),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: SeasonPayload) => {
      if (isEdit && seasonId) {
        return updateSeason(clubId as string, seasonId, payload)
      }
      return createSeason(clubId as string, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'seasons'] })
      navigate('/manage/fixtures/seasons')
    },
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isEdit && isLoading) {
    return null
  }

  if (isEdit && (isError || !season)) {
    return (
      <EmptyState
        title="Couldn't load this season"
        description="Something went wrong loading this season. Please try again."
      />
    )
  }

  return (
    <RecordFormScreen
      title={isEdit ? 'Edit Season' : 'Add Season'}
      backTo="/manage/fixtures/seasons"
      backLabel="Back to Seasons"
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {saveMutation.isError && (
            <Typography variant="body2" color="error.main">
              {errorDetail(saveMutation.error, 'Something went wrong saving this season. Please try again.')}
            </Typography>
          )}

          <Button type="submit" form={SEASON_FORM_ID} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create season'}
          </Button>
        </Stack>
      }
    >
      <SeasonForm
        initialValues={
          season ? { label: season.label, startDate: season.startDate, endDate: season.endDate } : undefined
        }
        onSubmit={(payload) => saveMutation.mutate(payload)}
      />
    </RecordFormScreen>
  )
}
