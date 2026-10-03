import { Box } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined'
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { RecordCard } from '../../../components/RecordCard'
import type { LeagueTeam } from '../../../api/leagueTeamApi'
import { initialsFromName } from '../../../utils/initials'

export interface LeagueTeamCardProps {
  leagueTeam: LeagueTeam
  onEdit: () => void
  onToggleActive: () => void
  onRemove: () => void
  togglePending?: boolean
}

// docs/specs/070-league-teams.md: one registered league team. No whole-card link: it has no detail
// screen. Inactive cards render muted (content only, so the footer actions stay at full strength).
export function LeagueTeamCard({ leagueTeam, onEdit, onToggleActive, onRemove, togglePending = false }: LeagueTeamCardProps) {
  const { name, abbreviation, logoUrl, active, referencedByMatchCount } = leagueTeam
  const fields = [
    ...(abbreviation ? [{ label: 'Abbreviation', value: abbreviation }] : []),
    ...(referencedByMatchCount > 0
      ? [{ label: 'Used in', value: `${referencedByMatchCount} ${referencedByMatchCount === 1 ? 'match' : 'matches'}` }]
      : []),
  ]

  return (
    <Box sx={active ? undefined : { height: '100%', '& .MuiCardContent-root': { opacity: 0.55 } }}>
      <RecordCard
        title={name}
        avatar={{ imageUrl: logoUrl, fallback: initialsFromName(abbreviation || name), shape: 'rounded' }}
        badge={active ? undefined : { label: 'Inactive', tone: 'muted' }}
        fields={fields}
        footerButtons={[
          { label: 'Edit', ariaLabel: `Edit ${name}`, icon: <EditOutlinedIcon fontSize="small" />, onClick: onEdit },
          {
            label: active ? 'Deactivate' : 'Reactivate',
            ariaLabel: `${active ? 'Deactivate' : 'Reactivate'} ${name}`,
            icon: active ? <ToggleOffOutlinedIcon fontSize="small" /> : <ToggleOnOutlinedIcon fontSize="small" />,
            onClick: onToggleActive,
            disabled: togglePending,
          },
          { label: 'Remove', ariaLabel: `Remove ${name}`, icon: <DeleteOutlineIcon fontSize="small" />, onClick: onRemove },
        ]}
      />
    </Box>
  )
}
