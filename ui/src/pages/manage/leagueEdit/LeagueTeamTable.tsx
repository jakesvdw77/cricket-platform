import { Avatar, Box, Chip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined'
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined'
import { avatarSx, badgeSx } from '../../../components/RecordCard'
import { RowActions } from '../../../components/RowActions'
import type { LeagueTeam } from '../../../api/leagueTeamApi'
import { initialsFromName } from '../../../utils/initials'
import { DESKTOP_ONLY, bodyRowSx, desktopOnly, headerRowSx } from './leagueEditRowStyles'

export interface LeagueTeamTableProps {
  teams: LeagueTeam[]
  onEdit: (team: LeagueTeam) => void
  onToggleActive: (team: LeagueTeam) => void
  onRemove: (team: LeagueTeam) => void
  togglePending?: boolean
}

const NONE = '-'

// Desktop: Team (logo, name), Abbreviation, Used in, Status, row actions. A phone keeps the name with the abbreviation and
// the match count under it, the status chip and the three-dot menu.
const COLUMNS = {
  xs: 'minmax(0, 1fr) auto 44px',
  sm: 'minmax(200px, 2fr) minmax(100px, 1fr) minmax(100px, 1fr) 90px 120px',
}

const usedIn = (count: number) => `${count} ${count === 1 ? 'match' : 'matches'}`

function LeagueTeamRow({ team, onEdit, onToggleActive, onRemove, togglePending }: { team: LeagueTeam } & Omit<LeagueTeamTableProps, 'teams'>) {
  const { name, abbreviation, logoUrl, active, referencedByMatchCount } = team
  const toggleLabel = active ? 'Deactivate' : 'Reactivate'
  // An inactive team's text is muted; its actions stay at full strength.
  const mutedSx = active ? undefined : { opacity: 0.55 }
  const phoneLine = [abbreviation, referencedByMatchCount > 0 ? usedIn(referencedByMatchCount) : null].filter(Boolean).join(' · ')

  return (
    <Box role="row" data-testid="league-team-row" data-inactive={active ? undefined : 'true'} sx={bodyRowSx(COLUMNS)}>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, ...mutedSx }}>
        <Avatar
          src={logoUrl ?? undefined}
          variant="rounded"
          sx={{
            ...avatarSx(32, '0.7rem'),
            borderRadius: 1,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            border: 1,
            borderColor: 'divider',
          }}
        >
          {abbreviation || initialsFromName(name)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap component="div" data-testid="league-team-name">
            {name}
          </Typography>
          {phoneLine && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              component="div"
              data-testid="league-team-phone-line"
              sx={{ display: { xs: 'block', sm: 'none' } }}
            >
              {phoneLine}
            </Typography>
          )}
        </Box>
      </Box>
      <Typography role="cell" variant="body2" noWrap sx={{ ...desktopOnly, ...mutedSx }} {...DESKTOP_ONLY} data-testid="league-team-abbreviation">
        {abbreviation || NONE}
      </Typography>
      <Typography
        role="cell"
        variant="body2"
        noWrap
        color={referencedByMatchCount > 0 ? undefined : 'text.secondary'}
        sx={{ ...desktopOnly, ...mutedSx }}
        {...DESKTOP_ONLY}
        data-testid="league-team-used-in"
      >
        {referencedByMatchCount > 0 ? usedIn(referencedByMatchCount) : NONE}
      </Typography>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center' }}>
        <Chip size="small" label={active ? 'Active' : 'Inactive'} sx={{ ...badgeSx(active ? 'active' : 'muted'), height: 22 }} />
      </Box>
      <Box role="cell" sx={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
        <RowActions
          label={name}
          actions={[
            { id: 'edit', label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => onEdit(team) },
            {
              id: 'toggle',
              label: toggleLabel,
              icon: active ? <ToggleOffOutlinedIcon fontSize="small" /> : <ToggleOnOutlinedIcon fontSize="small" />,
              onClick: () => onToggleActive(team),
              disabled: togglePending,
            },
            { id: 'remove', label: 'Remove', icon: <DeleteOutlineIcon fontSize="small" />, onClick: () => onRemove(team), destructive: true },
          ]}
        />
      </Box>
    </Box>
  )
}

// docs/specs/095-league-edit-gold-standard.md (replaces 070's LeagueTeamCard): the league's own opponent teams as flush zebra
// rows. Presentational: the section owns the dialogs and mutations.
export function LeagueTeamTable({ teams, onEdit, onToggleActive, onRemove, togglePending = false }: LeagueTeamTableProps) {
  return (
    <Box role="table" aria-label="League teams" sx={{ borderTop: 1, borderColor: 'divider' }}>
      <Box role="row" sx={headerRowSx(COLUMNS)}>
        <Box role="columnheader">Team</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Abbreviation</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Used in</Box>
        <Box role="columnheader">Status</Box>
        <Box role="columnheader" sx={{ display: { xs: 'none', sm: 'block' } }} aria-label="Actions" />
      </Box>
      <Box role="rowgroup">
        {teams.map((team) => (
          <LeagueTeamRow key={team.id} team={team} onEdit={onEdit} onToggleActive={onToggleActive} onRemove={onRemove} togglePending={togglePending} />
        ))}
      </Box>
    </Box>
  )
}
