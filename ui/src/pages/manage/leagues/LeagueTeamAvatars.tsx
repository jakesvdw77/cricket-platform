import { Avatar, Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { avatarSx } from '../../../components/RecordCard'
import type { LeagueSeasonTeam } from '../../../api/leagueApi'
import { initialsFromName } from '../../../utils/initials'

// docs/specs/071-league-card-redesign.md section 2: every team of the league's current season as a
// wrapping row of avatars (no cap, no "+N"), in the order received (the club's own first, then the
// league's other teams). Own teams are solid primary, league teams the neutral tinted style.
export function LeagueTeamAvatars({ teams }: { teams: LeagueSeasonTeam[] | null }) {
  if (!teams || teams.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No teams registered for this season
      </Typography>
    )
  }

  return (
    <Box role="list" aria-label="Teams" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
      {teams.map((team, index) => {
        const initials = initialsFromName(team.name)
        const caption = team.abbreviation || initials
        return (
          <Box
            key={`${index}-${team.name}`}
            role="listitem"
            title={team.name}
            aria-label={team.name}
            sx={{ width: 46, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
          >
            <Avatar
              src={team.logoUrl ?? undefined}
              alt=""
              sx={
                team.own
                  ? avatarSx(34, '0.75rem')
                  : {
                      ...avatarSx(34, '0.75rem'),
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                      color: 'primary.dark',
                      border: 1,
                      borderColor: 'divider',
                    }
              }
            >
              {caption}
            </Avatar>
            <Typography
              component="span"
              sx={{
                maxWidth: '100%',
                fontSize: '0.65625rem',
                fontWeight: 600,
                lineHeight: 1.2,
                color: 'text.secondary',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {caption}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
