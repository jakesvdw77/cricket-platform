import { useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import { RecordDetailScreen, DetailFieldRow, DetailFieldGrid } from '../../components/RecordDetailScreen'
import { EmptyState } from '../../components/EmptyState'
import { listSeasons } from '../../api/seasonApi'
import { badgeFor } from './SeasonList'

// docs/specs/036-view-first-record-detail-screens.md: the read-only counterpart to
// SeasonFormPage.tsx — same data-fetch shape (list + find-by-id, no single-season GET exists),
// same badgeFor mapping (imported, not duplicated). One un-headed section, since Season was
// already untabbed on its edit form.
export default function SeasonDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { seasonId } = useParams<{ seasonId?: string }>()

  const {
    data: season,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
    select: (seasons) => seasons.find((candidate) => candidate.id === seasonId),
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !season) {
    return (
      <EmptyState
        title="Couldn't load this season"
        description="Something went wrong loading this season. Please try again."
      />
    )
  }

  return (
    <RecordDetailScreen
      title={season.label}
      backTo="/manage/fixtures/seasons"
      backLabel="Back to Seasons"
      avatar={{ fallback: <EventOutlinedIcon fontSize="small" />, shape: 'rounded' }}
      badge={badgeFor(season)}
      editTo={`/manage/fixtures/seasons/${season.id}/edit`}
      sections={[
        {
          content: (
            <DetailFieldGrid>
              <DetailFieldRow icon={<LabelOutlinedIcon />} label="Label" value={season.label} />
              <DetailFieldRow icon={<CalendarTodayOutlinedIcon />} label="Start date" value={season.startDate} />
              <DetailFieldRow icon={<CalendarTodayOutlinedIcon />} label="End date" value={season.endDate} />
            </DetailFieldGrid>
          ),
        },
      ]}
    />
  )
}
