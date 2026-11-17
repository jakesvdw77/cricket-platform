import { Avatar, Box } from '@mui/material'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import { matchSideName } from './matchCardHelpers'
import { logoFor } from './teamLogoHelpers'

// Both sides of a match as two small logos, home then away: a club team's own logo, an opponent's copied logo, or the initials when
// there is none (the same logoFor rule the result cards use). The Matches list rows and cards both show it, so the opposition is
// always as visible as the club's own side.
export function MatchLogoPair({ match, teamsById, size = 40 }: { match: Match; teamsById: Map<string, Team>; size?: number }) {
  const sides = [
    { key: 'home', name: matchSideName(match, 'home', teamsById), logo: logoFor(match.homeTeamId, match.homeTeamLogoUrl, matchSideName(match, 'home', teamsById), teamsById) },
    { key: 'away', name: matchSideName(match, 'away', teamsById), logo: logoFor(match.awayTeamId, match.awayTeamLogoUrl, matchSideName(match, 'away', teamsById), teamsById) },
  ]
  return (
    <Box data-testid="match-logo-pair" aria-hidden sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 'none' }}>
      {sides.map((side) => (
        <Avatar
          key={side.key}
          variant="rounded"
          src={side.logo.src ?? undefined}
          alt=""
          data-testid={`match-logo-${side.key}`}
          sx={{
            width: { xs: size - 6, sm: size },
            height: { xs: size - 6, sm: size },
            flex: 'none',
            fontSize: '0.65rem',
            fontWeight: 700,
            bgcolor: 'background.paper',
            color: 'primary.main',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1.25,
          }}
        >
          {side.logo.initials}
        </Avatar>
      ))}
    </Box>
  )
}
