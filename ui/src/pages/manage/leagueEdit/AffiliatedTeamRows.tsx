import { useState } from 'react'
import { Avatar, Box, Typography } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined'
import { useMutation } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { avatarSx } from '../../../components/RecordCard'
import { RowActions } from '../../../components/RowActions'
import { unaffiliateLeagueTeam } from '../../../api/leagueAffiliationApi'
import type { LeagueAffiliation } from '../../../api/leagueAffiliationApi'
import type { Team } from '../../../api/teamApi'
import { initialsFromName } from '../../../utils/initials'
import { LeagueEditPanel } from './LeagueEditPanel'
import { bodyRowSx } from './leagueEditRowStyles'

export interface AffiliatedTeamRowsProps {
  clubId: string
  leagueId: string
  // The season the page's header pill has selected, as its label ("2026/27"), used in the Unaffiliate confirmation.
  seasonLabel: string
  affiliations: LeagueAffiliation[]
  teamsById: Map<string, Team>
  // Add team is disabled while no season is selected.
  canAdd: boolean
  onAddTeam: () => void
  onUnlinked: () => void
}

const COLUMNS = { xs: 'minmax(0, 1fr) 44px', sm: 'minmax(0, 1fr) 80px' }

// One affiliated team, with its own unlink mutation (mirrors TeamFormPage's TeamSponsorCard isolation pattern), so one
// row's pending state never leaks onto another's. Unaffiliate asks first.
function AffiliatedTeamRow({
  clubId,
  leagueId,
  seasonLabel,
  affiliation,
  team,
  onUnlinked,
}: {
  clubId: string
  leagueId: string
  seasonLabel: string
  affiliation: LeagueAffiliation
  team: Team
  onUnlinked: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const unlink = useMutation({
    mutationFn: () => unaffiliateLeagueTeam(clubId, leagueId, affiliation.id),
    onSuccess: () => {
      setConfirming(false)
      onUnlinked()
    },
    onError: () => setConfirming(false),
  })

  return (
    <Box role="row" data-testid="affiliated-team-row" sx={bodyRowSx(COLUMNS)}>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Avatar src={team.logoUrl ?? undefined} variant="rounded" sx={{ ...avatarSx(32, '0.75rem'), borderRadius: 1 }}>
          {initialsFromName(team.name)}
        </Avatar>
        <Typography variant="body2" fontWeight={600} noWrap>
          {team.name}
        </Typography>
      </Box>
      <Box role="cell" sx={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
        <RowActions
          label={team.name}
          actions={[
            { id: 'edit', label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, to: `/manage/sections/${team.sectionId}/teams/${team.id}/edit` },
            {
              id: 'unaffiliate',
              label: 'Unaffiliate',
              icon: <LinkOffOutlinedIcon fontSize="small" />,
              onClick: () => setConfirming(true),
              disabled: unlink.isPending,
            },
          ]}
        />
      </Box>
      <ConfirmDialog
        open={confirming}
        title={`Unaffiliate ${team.name} from this season?`}
        description={`This removes ${team.name} from this league for ${seasonLabel}. The team and its matches are kept, and you can affiliate it again at any time.`}
        confirmLabel="Unaffiliate"
        pendingLabel="Removing..."
        destructive
        pending={unlink.isPending}
        onConfirm={() => unlink.mutate()}
        onClose={() => setConfirming(false)}
      />
    </Box>
  )
}

// docs/specs/095-league-edit-gold-standard.md: "Our teams" on the Teams tab of Edit League. A bordered panel with the one
// filled Add team button in its header and flush zebra rows below (logo, name, Edit and Unaffiliate).
export function AffiliatedTeamRows({ clubId, leagueId, seasonLabel, affiliations, teamsById, canAdd, onAddTeam, onUnlinked }: AffiliatedTeamRowsProps) {
  const rows = affiliations.flatMap((affiliation) => {
    const team = teamsById.get(affiliation.teamId)
    return team ? [{ affiliation, team }] : []
  })

  return (
    <LeagueEditPanel
      icon={<GroupsOutlinedIcon />}
      title={`Our teams · ${rows.length}`}
      testId="affiliated-teams-panel"
      ariaLabel="Our teams"
      actions={
        <Button size="sm" startIcon={<GroupsOutlinedIcon fontSize="small" />} onClick={onAddTeam} disabled={!canAdd} sx={{ flex: 'none' }}>
          Add team
        </Button>
      }
    >
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
          No teams affiliated for this season yet.
        </Typography>
      ) : (
        <Box role="table" aria-label="Our teams" sx={{ borderTop: 1, borderColor: 'divider' }}>
          <Box role="rowgroup">
            {rows.map(({ affiliation, team }) => (
              <AffiliatedTeamRow
                key={affiliation.id}
                clubId={clubId}
                leagueId={leagueId}
                seasonLabel={seasonLabel}
                affiliation={affiliation}
                team={team}
                onUnlinked={onUnlinked}
              />
            ))}
          </Box>
        </Box>
      )}
    </LeagueEditPanel>
  )
}
