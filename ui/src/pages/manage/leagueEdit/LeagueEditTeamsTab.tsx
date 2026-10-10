import { Box, Typography } from '@mui/material'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined'
import { useMutation } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { RecordCard } from '../../../components/RecordCard'
import { LeagueTeamsSection } from '../leagueTeams/LeagueTeamsSection'
import { unaffiliateLeagueTeam } from '../../../api/leagueAffiliationApi'
import type { LeagueAffiliation } from '../../../api/leagueAffiliationApi'
import type { Team } from '../../../api/teamApi'
import { initialsFromName } from '../../../utils/initials'

// One affiliated team, with its own unlink mutation — mirrors TeamFormPage's TeamSponsorCard
// isolation pattern, so one card's pending state never leaks onto another's.
function AffiliatedTeamCard({
  clubId,
  leagueId,
  affiliation,
  team,
  onUnlinked,
}: {
  clubId: string
  leagueId: string
  affiliation: LeagueAffiliation
  team: Team
  onUnlinked: () => void
}) {
  const unlink = useMutation({
    mutationFn: () => unaffiliateLeagueTeam(clubId, leagueId, affiliation.id),
    onSuccess: onUnlinked,
  })

  return (
    <RecordCard
      title={team.name}
      avatar={{ imageUrl: team.logoUrl, fallback: initialsFromName(team.name), shape: 'rounded' }}
      editLabel="Edit"
      editTo={`/manage/sections/${team.sectionId}/teams/${team.id}/edit`}
      secondaryAction={{
        label: 'Unaffiliate',
        pendingLabel: 'Removing…',
        pending: unlink.isPending,
        onClick: () => unlink.mutate(),
        icon: <LinkOffOutlinedIcon fontSize="small" />,
      }}
    />
  )
}

export interface LeagueEditTeamsTabProps {
  clubId: string
  leagueId: string
  hasSeasons: boolean
  selectedSeasonId: string
  // "<league name> · <season label>", shown by the league teams section's dialogs.
  contextLabel: string
  affiliationsForSeason: LeagueAffiliation[]
  teamsById: Map<string, Team>
  onAddTeam: () => void
  onUnlinked: () => void
}

// docs/specs/029-league-management.md and docs/specs/070: the Teams tab of Edit League, the club's affiliated teams for the
// selected season (the season comes from the page's header pill) and the league's own opponent teams. Keeps today's content;
// restyled in a later step of spec 095.
export function LeagueEditTeamsTab({
  clubId,
  leagueId,
  hasSeasons,
  selectedSeasonId,
  contextLabel,
  affiliationsForSeason,
  teamsById,
  onAddTeam,
  onUnlinked,
}: LeagueEditTeamsTabProps) {
  return (
    <Box sx={{ gridColumn: '1 / -1' }}>
      {!hasSeasons ? (
        <Typography variant="body2" color="text.secondary">
          Create a season first — teams are affiliated to a league for a specific season.
        </Typography>
      ) : (
        <>
          <Typography variant="subtitle1" component="h2" fontWeight={700} sx={{ mb: 1 }}>
            Our teams
          </Typography>

          {affiliationsForSeason.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              No teams affiliated for this season yet.
            </Typography>
          )}

          {affiliationsForSeason.length > 0 && (
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                mb: 2,
              }}
            >
              {affiliationsForSeason.map((affiliation) => {
                const team = teamsById.get(affiliation.teamId)
                if (!team) {
                  return null
                }
                return (
                  <AffiliatedTeamCard
                    key={affiliation.id}
                    clubId={clubId}
                    leagueId={leagueId}
                    affiliation={affiliation}
                    team={team}
                    onUnlinked={onUnlinked}
                  />
                )
              })}
            </Box>
          )}

          <Button
            variant="secondary"
            size="sm"
            startIcon={<GroupsOutlinedIcon fontSize="small" />}
            onClick={onAddTeam}
            disabled={!selectedSeasonId}
          >
            Add team
          </Button>

          {selectedSeasonId && (
            <LeagueTeamsSection
              key={selectedSeasonId}
              clubId={clubId}
              leagueId={leagueId}
              seasonId={selectedSeasonId}
              contextLabel={contextLabel}
            />
          )}
        </>
      )}
    </Box>
  )
}
