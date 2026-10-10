import { Avatar, Box, Button as MuiButton, ListSubheader, MenuItem, Stack, ToggleButton, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { Input } from '../Input'
import { MediaUpload } from '../MediaUpload'
import { avatarSx } from '../RecordCard'
import type { Team } from '../../api/teamApi'
import type { LeagueTeam } from '../../api/leagueTeamApi'
import { initialsFromName } from '../../utils/initials'

// docs/specs/070-league-teams.md: a side is one of our own teams, a registered league team, or a
// free-text opponent.
export type SideMode = 'team' | 'leagueTeam' | 'external'

export interface SideState {
  mode: SideMode
  teamId: string
  // Free text in 'external' mode; the league team's display name in 'leagueTeam' mode (never sent).
  teamName: string
  teamLogoUrl: string
  leagueTeamId: string
}

export interface SideErrors {
  team?: string
  name?: string
  leagueTeam?: string
}

export interface MatchSideFieldsProps {
  // 'Home' | 'Away' - drives the labels.
  label: 'Home' | 'Away'
  value: SideState
  errors: SideErrors
  onChange: (patch: Partial<SideState>) => void
  teamOptions: Team[]
  narrowedByAffiliation: boolean
  // The league's teams for the chosen league and season (active and inactive); only active ones
  // are offered, plus the side's own current pick.
  leagueTeams: LeagueTeam[]
  canUseLeagueTeams: boolean
  // Both a league and a season are chosen.
  hasScope: boolean
  leagueId: string
  leagueTeamsLoading?: boolean
}

const OUR_PREFIX = 'team:'
const LEAGUE_PREFIX = 'lt:'

// One Home/Away block of MatchForm: the three-way toggle plus the field(s) for the chosen mode.
export function MatchSideFields({
  label,
  value,
  errors,
  onChange,
  teamOptions,
  narrowedByAffiliation,
  leagueTeams,
  canUseLeagueTeams,
  hasScope,
  leagueId,
  leagueTeamsLoading = false,
}: MatchSideFieldsProps) {
  const showLeagueButton = canUseLeagueTeams || value.mode === 'leagueTeam'

  const pickable = leagueTeams.filter((team) => team.active || team.id === value.leagueTeamId)
  const selectedKnown = pickable.some((team) => team.id === value.leagueTeamId)
  const selectedValue = value.leagueTeamId ? `${LEAGUE_PREFIX}${value.leagueTeamId}` : ''

  const handleModeChange = (next: SideMode) => {
    if (next === value.mode) {
      return
    }
    onChange({
      mode: next,
      // A logo only belongs to a free-text side; a league-team side never holds team/free text.
      ...(next !== 'external' ? { teamLogoUrl: '' } : {}),
      ...(next === 'leagueTeam' ? { teamId: '', teamName: '' } : {}),
      ...(next !== 'leagueTeam' ? { leagueTeamId: '' } : {}),
      ...(next === 'team' && value.mode === 'leagueTeam' ? { teamName: '' } : {}),
    })
  }

  const handlePick = (picked: string) => {
    if (picked.startsWith(OUR_PREFIX)) {
      // An "Our teams" entry behaves exactly as My team does.
      onChange({ mode: 'team', teamId: picked.slice(OUR_PREFIX.length), leagueTeamId: '', teamName: '', teamLogoUrl: '' })
      return
    }
    const id = picked.slice(LEAGUE_PREFIX.length)
    const team = leagueTeams.find((candidate) => candidate.id === id)
    onChange({ leagueTeamId: id, teamId: '', teamName: team?.name ?? '', teamLogoUrl: '' })
  }

  return (
    <Box
      data-testid={`match-side-${label.toLowerCase()}`}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, minWidth: 0 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" fontWeight={700}>
          {label} side
        </Typography>
        <CompactToggleGroup<SideMode>
          value={value.mode}
          onChange={handleModeChange}
          ariaLabel={`${label} side`}
          fullWidthOnPhone
        >
          <ToggleButton value="team">My team</ToggleButton>
          {showLeagueButton && (
            <ToggleButton value="leagueTeam" aria-label="League team" disabled={!hasScope && value.mode !== 'leagueTeam'}>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }} aria-hidden>
                League
              </Box>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }} aria-hidden>
                League team
              </Box>
            </ToggleButton>
          )}
          <ToggleButton value="external">Other</ToggleButton>
        </CompactToggleGroup>
      </Box>

      {value.mode === 'team' && (
        <Input
          select
          label={`${label} team`}
          value={value.teamId}
          onChange={(event) => onChange({ teamId: event.target.value })}
          error={Boolean(errors.team)}
          helperText={errors.team ?? (narrowedByAffiliation ? 'Only teams affiliated with this League for this Season' : undefined)}
        >
          {teamOptions.map((team) => (
            <MenuItem key={team.id} value={team.id}>
              {team.name}
            </MenuItem>
          ))}
        </Input>
      )}

      {value.mode === 'leagueTeam' && (
        <>
          <Input
            select
            label={`${label} league team`}
            value={selectedValue}
            onChange={(event) => handlePick(event.target.value)}
            error={Boolean(errors.leagueTeam)}
            helperText={errors.leagueTeam}
            disabled={!hasScope}
            SelectProps={{ MenuProps: { slotProps: { paper: { sx: { maxHeight: 360 } } } } }}
          >
            {[
              teamOptions.length > 0 && <ListSubheader key="our-header">Our teams</ListSubheader>,
              ...teamOptions.map((team) => (
                <MenuItem key={`${OUR_PREFIX}${team.id}`} value={`${OUR_PREFIX}${team.id}`}>
                  <OptionRow name={team.name} logoUrl={team.logoUrl} />
                </MenuItem>
              )),
              (pickable.length > 0 || (value.leagueTeamId && !selectedKnown)) && (
                <ListSubheader key="league-header">League teams</ListSubheader>
              ),
              ...(value.leagueTeamId && !selectedKnown
                ? [
                    <MenuItem key={`${LEAGUE_PREFIX}${value.leagueTeamId}`} value={`${LEAGUE_PREFIX}${value.leagueTeamId}`}>
                      <OptionRow name={value.teamName || 'League team'} logoUrl={null} />
                    </MenuItem>,
                  ]
                : []),
              ...pickable.map((team) => (
                <MenuItem key={`${LEAGUE_PREFIX}${team.id}`} value={`${LEAGUE_PREFIX}${team.id}`}>
                  <OptionRow
                    name={team.active ? team.name : `${team.name} (Inactive)`}
                    logoUrl={team.logoUrl}
                    abbreviation={team.abbreviation}
                  />
                </MenuItem>
              )),
            ].filter(Boolean)}
          </Input>
          {hasScope && !leagueTeamsLoading && canUseLeagueTeams && pickable.length === 0 && (
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
              <Typography variant="caption" color="text.secondary">
                No league teams registered for this league and season.
              </Typography>
              {leagueId && (
                <MuiButton size="small" variant="outlined" component={RouterLink} to={`/manage/fixtures/leagues/${leagueId}/edit?tab=teams`}>
                  Open the league&apos;s Teams tab
                </MuiButton>
              )}
            </Stack>
          )}
        </>
      )}

      {value.mode === 'external' && (
        <>
          <Input
            label={`${label} opponent name`}
            value={value.teamName}
            onChange={(event) => onChange({ teamName: event.target.value })}
            error={Boolean(errors.name)}
            helperText={errors.name ?? 'e.g. Riverside Occasionals'}
          />
          <MediaUpload
            label="Logo"
            value={value.teamLogoUrl || null}
            onUploaded={(url) => onChange({ teamLogoUrl: url })}
            variant="logo"
            namespace="manage"
          />
        </>
      )}
    </Box>
  )
}

function OptionRow({ name, logoUrl, abbreviation }: { name: string; logoUrl: string | null; abbreviation?: string | null }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
      <Avatar src={logoUrl ?? undefined} variant="rounded" sx={avatarSx(28, '0.65rem')}>
        {initialsFromName(abbreviation || name)}
      </Avatar>
      <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {name}
      </Typography>
      {abbreviation && (
        <Typography variant="caption" color="text.secondary">
          {abbreviation}
        </Typography>
      )}
    </Stack>
  )
}
