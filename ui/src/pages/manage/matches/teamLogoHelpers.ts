import type { Team } from '../../../api/teamApi'
import { initialsFromName } from '../../../utils/initials'

export interface SideLogo {
  src: string | null
  initials: string
}

// Source per side (spec 1a): a real team's logo is Team.logoUrl; a free-text or league-team
// opponent's is the match's copied side logo. No logo shows initials: the team's abbreviation when
// it has one, else the name's initials.
export function logoFor(
  teamId: string | null,
  sideLogoUrl: string | null,
  name: string,
  teamsById: Map<string, Team>,
): SideLogo {
  const team = teamId ? teamsById.get(teamId) : undefined
  const src = teamId ? (team?.logoUrl ?? null) : sideLogoUrl
  return { src, initials: team?.abbreviation || initialsFromName(name) }
}
