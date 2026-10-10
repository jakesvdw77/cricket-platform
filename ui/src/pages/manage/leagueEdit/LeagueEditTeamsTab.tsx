import { Box, Typography } from '@mui/material'
import { LeagueTeamsSection } from '../leagueTeams/LeagueTeamsSection'
import type { LeagueAffiliation } from '../../../api/leagueAffiliationApi'
import type { Team } from '../../../api/teamApi'
import { AffiliatedTeamRows } from './AffiliatedTeamRows'

export interface LeagueEditTeamsTabProps {
  clubId: string
  leagueId: string
  hasSeasons: boolean
  selectedSeasonId: string
  // The selected season's label ("2026/27"), used in the Unaffiliate confirmation.
  seasonLabel: string
  // "<league name> · <season label>", shown by the league teams section's dialogs.
  contextLabel: string
  affiliationsForSeason: LeagueAffiliation[]
  teamsById: Map<string, Team>
  onAddTeam: () => void
  onUnlinked: () => void
}

// docs/specs/095-league-edit-gold-standard.md: the Teams tab of Edit League, two matching panels for the season in the page's
// header pill: the club's affiliated teams ("Our teams") and the league's own opponent teams ("League teams").
export function LeagueEditTeamsTab({
  clubId,
  leagueId,
  hasSeasons,
  selectedSeasonId,
  seasonLabel,
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <AffiliatedTeamRows
            clubId={clubId}
            leagueId={leagueId}
            seasonLabel={seasonLabel}
            affiliations={affiliationsForSeason}
            teamsById={teamsById}
            canAdd={Boolean(selectedSeasonId)}
            onAddTeam={onAddTeam}
            onUnlinked={onUnlinked}
          />
          {selectedSeasonId && (
            <LeagueTeamsSection key={selectedSeasonId} clubId={clubId} leagueId={leagueId} seasonId={selectedSeasonId} contextLabel={contextLabel} />
          )}
        </Box>
      )}
    </Box>
  )
}
