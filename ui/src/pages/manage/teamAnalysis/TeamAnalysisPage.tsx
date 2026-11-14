import { useMemo, useState } from 'react'
import { Link as RouterLink, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, Chip, LinearProgress, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined'
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined'
import ElderlyOutlinedIcon from '@mui/icons-material/ElderlyOutlined'
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'
import { EmptyState } from '../../../components/EmptyState'
import { HeaderSeasonSelect } from '../../../components/HeaderSeasonSelect'
import { HeaderShareButton } from '../../../components/HeaderShareButton'
import { ShareAnalysisDialog } from '../../../components/ShareAnalysisDialog'
import { InfoCard } from '../../../components/InfoCard'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { PageCounters } from '../../../components/PageCounters'
import { listTeamsForClub } from '../../../api/teamApi'
import { listSeasons } from '../../../api/seasonApi'
import { listSquad } from '../../../api/teamSquadApi'
import { getManagedClubProfile } from '../../../api/clubApi'
import { useBackLink } from '../../../hooks/useReturnTo'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { pickDefaultSeasonId } from '../../../utils/defaultSeason'
import { BATTING_POSITION_LABEL } from '../../../utils/playerLabels'
import { analyseSquad, BATTING_POSITIONS, FULL_SIDE } from '../../../utils/squadAnalysis'

// docs/specs/151-server-test-round-one.md, slice B: the shape of a team's squad for one season. Nothing is stored and there is no
// endpoint of its own: the squad list the Team page already reads, worked out by utils/squadAnalysis. Things To Check comes first so the
// gaps are the first thing read.

const NameList = ({ names, empty = 'Nobody' }: { names: string[]; empty?: string }) =>
  names.length === 0 ? (
    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
      {empty}
    </Typography>
  ) : (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {names.map((name) => (
        <Typography key={name} component="li" variant="body2" sx={{ py: 0.4, borderBottom: 1, borderColor: 'divider' }}>
          {name}
        </Typography>
      ))}
    </Box>
  )

function Row({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} data-testid={testId}>
        {value}
      </Typography>
    </Box>
  )
}

function Bar({ label, count, of }: { label: string; count: number; of: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 0.75 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 96, flex: 'none' }}>
        {label}
      </Typography>
      <LinearProgress variant="determinate" value={of > 0 ? Math.min(100, (count / of) * 100) : 0} sx={{ flex: 1, height: 10, borderRadius: 1 }} />
      <Typography variant="body2" fontWeight={600} sx={{ width: 24, textAlign: 'right' }}>
        {count}
      </Typography>
    </Box>
  )
}

export default function TeamAnalysisPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { teamId } = useParams<{ teamId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const back = useBackLink(undefined, 'Back to Team')

  const teamQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
    select: (teams) => teams.find((candidate) => candidate.id === teamId),
  })
  const team = teamQuery.data
  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId) && Boolean(teamId),
  })
  const seasons = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data])
  const seasonParam = searchParams.get('seasonId')
  const seasonId = seasonParam && seasons.some((season) => season.id === seasonParam) ? seasonParam : (pickDefaultSeasonId(seasons) ?? '')

  const squadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', seasonId, 'squad'],
    queryFn: () => listSquad(clubId as string, teamId as string, seasonId),
    enabled: Boolean(clubId) && Boolean(teamId) && Boolean(seasonId),
  })

  const analysis = useMemo(() => analyseSquad(squadQuery.data ?? []), [squadQuery.data])
  const [shareOpen, setShareOpen] = useState(false)
  const clubProfile = useQuery({ queryKey: ['managed-club', clubId, 'profile'], queryFn: () => getManagedClubProfile(clubId as string), enabled: Boolean(clubId) })
  useDocumentTitle(team ? `${team.name} · Squad Analysis` : 'Squad analysis')

  if (!clubId) return <EmptyState title="Not authorized" description="No club is associated with your account." />
  if (teamQuery.isLoading) return null
  if (teamQuery.isError || !team) {
    return <EmptyState title="Couldn't load this team" description="Something went wrong loading this team. Please try again." />
  }

  const teamPath = `/manage/sections/${team.sectionId}/teams/${team.id}${seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : ''}`
  const backTo = back.to ?? teamPath
  const { hands, experience } = analysis
  const bowlingTotal = Math.max(1, analysis.mainBowlers.length + analysis.partTimeBowlers.length)
  const warnings = analysis.gaps.filter((gap) => gap.tone === 'warning')

  const header = (
    <ManageScreenHeader
      title={`${team.name} Squad Analysis`}
      action={analysis.size > 0 ? <HeaderShareButton onClick={() => setShareOpen(true)} testId="analysis-share" /> : undefined}
      backTo={backTo}
      backLabel={back.to ? back.label : 'Back to Team'}
      titleAdornment={
        seasons.length > 0 ? (
          <HeaderSeasonSelect
            seasons={seasons.map((season) => ({ id: season.id, name: season.label }))}
            value={seasonId || null}
            onChange={(next) => {
              if (!next) return
              setSearchParams((previous) => {
                const updated = new URLSearchParams(previous)
                updated.set('seasonId', next)
                return updated
              }, { replace: true })
            }}
            showAll={false}
          />
        ) : undefined
      }
    />
  )

  if (squadQuery.isSuccess && analysis.size === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2 } }}>
        {header}
        <EmptyState
          title="No players in this squad yet"
          description="Add players to this team's squad for the season to see how the side is shaped."
          action={
            <Typography component={RouterLink} to={`${teamPath}#squad`} variant="body2" sx={{ textDecoration: 'underline' }}>
              Go To The Squad
            </Typography>
          }
        />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2 } }} data-testid="team-analysis">
      {header}

      <ShareAnalysisDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        clubId={clubId}
        teamName={team.name}
        sectionId={team.sectionId}
        seasonLabel={seasons.find((season) => season.id === seasonId)?.label ?? null}
        clubName={clubProfile.data?.name ?? null}
        players={squadQuery.data ?? []}
      />

      <PageCounters
        density="compact"
        loading={squadQuery.isPending}
        items={[
          { id: 'players', testId: 'analysis-players', value: analysis.size, label: 'Players In Squad', shortLabel: 'Players' },
          { id: 'batters', testId: 'analysis-batters', value: analysis.batters.length, label: 'Batters' },
          { id: 'main', testId: 'analysis-main-bowlers', value: analysis.mainBowlers.length, label: 'Main Bowlers', shortLabel: 'Bowlers' },
          { id: 'part', testId: 'analysis-part-time', value: analysis.partTimeBowlers.length, label: 'Part-Time Bowlers', shortLabel: 'Part-Time' },
          { id: 'all', testId: 'analysis-all-rounders', value: analysis.allRounders.length, label: 'All-Rounders' },
          { id: 'keepers', testId: 'analysis-keepers', value: analysis.keepers.length, label: 'Wicketkeepers', shortLabel: 'Keepers' },
        ]}
      />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, alignItems: 'stretch' }}>
        <Box sx={{ gridColumn: '1 / -1' }}>
          <InfoCard flat testId="analysis-gaps" title="Things To Check" icon={warnings.length > 0 ? <ReportProblemOutlinedIcon /> : <CheckCircleOutlineIcon />} tone={warnings.length > 0 ? 'warning' : 'default'}>
            {analysis.gaps.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nothing to check yet.
              </Typography>
            ) : (
              analysis.gaps.map((gap) => (
                <Box key={gap.id} data-testid={`gap-${gap.id}`} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', my: 0.75 }}>
                  {gap.tone === 'warning' ? (
                    <ReportProblemOutlinedIcon fontSize="small" sx={{ color: 'warning.main', mt: '1px' }} />
                  ) : (
                    <CheckCircleOutlineIcon fontSize="small" sx={{ color: 'success.main', mt: '1px' }} />
                  )}
                  <Typography variant="body2">{gap.text}</Typography>
                </Box>
              ))
            )}
          </InfoCard>
        </Box>

        <Box sx={{ gridColumn: '1 / -1' }}>
          <InfoCard flat testId="analysis-batting-order" title="Batting Order" icon={<FormatListNumberedOutlinedIcon />}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
              {BATTING_POSITIONS.map((position) => (
                <Box key={position} data-testid={`order-${position}`}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: 2, borderColor: 'secondary.main', pb: 0.5, mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {BATTING_POSITION_LABEL[position]}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {analysis.battingOrder[position].length}
                    </Typography>
                  </Box>
                  <NameList names={analysis.battingOrder[position]} />
                </Box>
              ))}
            </Box>
            {analysis.battingNotSet.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }} data-testid="order-not-set">
                Not set: {analysis.battingNotSet.join(', ')}
              </Typography>
            )}
          </InfoCard>
        </Box>

        <InfoCard flat testId="analysis-bowling" title="Bowling" icon={<SportsCricketOutlinedIcon />}>
          <Bar label="Pace" count={analysis.bowling.pace.length} of={bowlingTotal} />
          <Bar label="Medium" count={analysis.bowling.medium.length} of={bowlingTotal} />
          <Bar label="Spin" count={analysis.bowling.spin.length} of={bowlingTotal} />
          <Bar label="Part-time" count={analysis.bowling.partTime.length} of={bowlingTotal} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Right-arm {hands.rightArm}, left-arm {hands.leftArm}, arm not set {hands.armNotSet}
          </Typography>
        </InfoCard>

        <InfoCard flat testId="analysis-hands" title="Hands" icon={<PanToolOutlinedIcon />}>
          <Row label="Right-hand batters" value={hands.rightBat} />
          <Row label="Left-hand batters" value={hands.leftBat} />
          <Row label="Stance not set" value={hands.batNotSet} />
          <Row label="Right-arm bowlers" value={hands.rightArm} />
          <Row label="Left-arm bowlers" value={hands.leftArm} />
        </InfoCard>

        <InfoCard flat testId="analysis-experience" title="Experience" icon={<ElderlyOutlinedIcon />}>
          <Row label="Average age" value={experience.averageAge ?? '–'} />
          <Row label="Youngest" value={experience.youngest ?? '–'} />
          <Row label="Oldest" value={experience.oldest ?? '–'} />
          <Row label="Squad size" value={`${analysis.size} of ${FULL_SIDE} needed`} />
        </InfoCard>

        <Box sx={{ gridColumn: '1 / -1' }}>
          <InfoCard flat testId="analysis-missing" title="Information Missing" icon={<HelpOutlineOutlinedIcon />}>
            {analysis.missing.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Every player has a batting position, a batting stance and a date of birth.
              </Typography>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  These players are not counted in some groups. Open the player to fill in the gaps.
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {analysis.missing.map((entry) => (
                    <Chip key={entry.name} size="small" variant="outlined" color="warning" label={`${entry.name}: ${entry.missing.join(', ')}`} />
                  ))}
                </Box>
              </>
            )}
          </InfoCard>
        </Box>
      </Box>
    </Box>
  )
}
