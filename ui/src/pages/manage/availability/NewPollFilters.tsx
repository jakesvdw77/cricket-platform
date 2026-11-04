import { Box, MenuItem, Typography } from '@mui/material'
import { Input } from '../../../components/Input'
import { SectionTreeSelect } from '../../../components/SectionTreeSelect'
import { ToolbarCard } from '../../../components/ToolbarCard'
import { compactFieldsSx } from '../../../utils/filterPanel'
import type { Section } from '../../../api/sectionApi'
import type { Team } from '../../../api/teamApi'

export interface NewPollFiltersProps {
  sections: Section[]
  // The teams offered (already narrowed to the chosen section).
  teams: Team[]
  sectionId: string | null
  teamId: string
  onSectionChange: (sectionId: string | null) => void
  onTeamChange: (teamId: string) => void
  disabled?: boolean
  hint: string
}

// docs/specs/136 (owner, 2026-11-04): both New Poll pages (Squad and Group) open on the matches with no poll and share ONE filter toolbar,
// Section and Team, so a manager can narrow either page the same way. "All Sections" and "All Teams" are the unfiltered state.
export function NewPollFilters({ sections, teams, sectionId, teamId, onSectionChange, onTeamChange, disabled, hint }: NewPollFiltersProps) {
  return (
    <ToolbarCard>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, ...compactFieldsSx }}>
        <Box sx={{ width: { xs: '100%', sm: 260 } }}>
          <SectionTreeSelect label="Section" sections={sections} value={sectionId} onChange={onSectionChange} allowClear allLabel="All Sections" />
        </Box>
        <Box sx={{ width: { xs: '100%', sm: 260 } }}>
          <Input select label="Team" value={teamId} onChange={(event) => onTeamChange(event.target.value)} disabled={disabled}>
            <MenuItem value="">All Teams</MenuItem>
            {teams.map((team) => (
              <MenuItem key={team.id} value={team.id}>
                {team.name}
              </MenuItem>
            ))}
          </Input>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      </Box>
    </ToolbarCard>
  )
}
