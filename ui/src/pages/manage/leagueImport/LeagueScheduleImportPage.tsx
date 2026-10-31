import { Box, CircularProgress } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { listLeagues } from '../../../api/leagueApi'
import { listSeasons } from '../../../api/seasonApi'
import { Button } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { ImportWizard } from '../../../components/ImportWizard'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useReturnTo } from '../../../hooks/useReturnTo'
import { LEAGUE_SCHEDULE_IMPORT_TYPE, buildLeagueScheduleScope, importScheduleDisabledReason, leagueScheduleBackPath } from '../../../utils/leagueScheduleImport'
import type { LeagueScheduleOrigin } from '../../../utils/leagueScheduleImport'
import { IMPORT_CONSUMERS } from '../imports/importConsumers'

const spinner = <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} aria-label="Loading the import" /></Box>

// docs/specs/098-league-schedule-import.md, "Entry points and routes": /manage/fixtures/leagues/:leagueId/schedule/import?seasonId=.
// The generic ImportWizard with this type's configuration (the consumer registry's entry, shared with the resume page). The
// season comes from ?seasonId=; ?from=view makes Back return to the league page's Schedule instead of the edit page's tab.
export default function LeagueScheduleImportPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { leagueId } = useParams<{ leagueId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const origin = useReturnTo()
  const seasonId = searchParams.get('seasonId') ?? ''
  const from: LeagueScheduleOrigin = searchParams.get('from') === 'view' ? 'view' : 'edit'
  useDocumentTitle('Import schedule')
  const leaguesQuery = useQuery({ queryKey: ['managed-club', clubId, 'leagues', 'list', { includeInactive: true }], queryFn: () => listLeagues(clubId as string, { includeInactive: true }), enabled: Boolean(clubId) })
  const seasonsQuery = useQuery({ queryKey: ['managed-club', clubId, 'seasons'], queryFn: () => listSeasons(clubId as string), enabled: Boolean(clubId) })
  const consumerProps = IMPORT_CONSUMERS[LEAGUE_SCHEDULE_IMPORT_TYPE].useWizardProps(clubId ?? '', { leagueId: leagueId ?? '', seasonId }, { from })

  if (!clubId) return <EmptyState title="Not authorised" description="No club is associated with your account." />
  if (leaguesQuery.isPending || seasonsQuery.isPending || !consumerProps) return spinner

  const league = leaguesQuery.data?.find((candidate) => candidate.id === leagueId)
  const season = seasonsQuery.data?.find((candidate) => candidate.id === seasonId)
  const back = <Button size="compact" onClick={() => navigate(origin ? origin.to : leagueScheduleBackPath(leagueId ?? '', seasonId || null, from))}>Back to the schedule</Button>
  if (!league) return <EmptyState title="League not found" description="It may have been removed, or it belongs to another club." action={back} />
  if (!season) return <EmptyState title="Choose a season" description="Open the league's schedule for a season, then choose Import schedule." action={back} />
  const reason = importScheduleDisabledReason({ hasSeason: true, leagueActive: league.active })
  if (reason) return <EmptyState title="This league cannot take an import" description="Reactivate the league first. Matches cannot be added to an inactive league." action={back} />

  return (
    <ImportWizard
      key={`${leagueId}-${seasonId}`}
      clubId={clubId}
      type={LEAGUE_SCHEDULE_IMPORT_TYPE}
      scope={buildLeagueScheduleScope({ leagueId: leagueId as string, seasonId })}
      {...consumerProps}
    />
  )
}
