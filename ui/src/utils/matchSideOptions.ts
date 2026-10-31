// A team cannot play itself, and a league match offers our teams and the league's teams together. Pure helpers for the
// Home/Away pickers of the Match form (shared so the import row editor can use the same rules).

// What one side currently is: one of our teams, a league team, or a typed name. The name is the team's display name
// (or the typed text); the ids are empty when the side is not that kind of team.
export interface SideIdentity {
  teamId?: string | null
  leagueTeamId?: string | null
  name?: string | null
}

interface NamedTeam {
  id: string
  name: string
  active: boolean
}

// Trimmed, lower case, inner runs of spaces collapsed to one.
export function normaliseTeamName(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function identityKeys(identity: SideIdentity | null | undefined): Set<string> {
  const keys = new Set<string>()
  if (!identity) return keys
  if (identity.teamId) keys.add(`team:${identity.teamId}`)
  if (identity.leagueTeamId) keys.add(`lt:${identity.leagueTeamId}`)
  const name = normaliseTeamName(identity.name)
  if (name) keys.add(`name:${name}`)
  return keys
}

// True when the two sides are the same team: the same own team id, the same league team id, or the same name (so an own
// team and a league team called the same thing count as one).
export function isSameTeam(a: SideIdentity | null | undefined, b: SideIdentity | null | undefined): boolean {
  const other = identityKeys(b)
  for (const key of identityKeys(a)) {
    if (other.has(key)) return true
  }
  return false
}

// Drops every option that is the other side's team. `keepId` is never dropped (the side's own current pick).
export function excludeOtherSide<T extends { id: string; name: string }>(
  options: T[],
  other: SideIdentity | null | undefined,
  kind: 'team' | 'leagueTeam',
  keepId?: string | null,
): T[] {
  if (!other) return options
  return options.filter(
    (option) =>
      option.id === keepId ||
      !isSameTeam(kind === 'team' ? { teamId: option.id, name: option.name } : { leagueTeamId: option.id, name: option.name }, other),
  )
}

export interface LeagueSideOptions<L extends NamedTeam> {
  own: NamedTeam[]
  league: L[]
}

// The default list for a side of a league match: our active teams entered in the league and season (every active team of
// ours when none is, `affiliatedTeamIds` null meaning no league chosen) plus the league's active teams, an own team winning
// over a league team of the same name, and the other side's team left out. The side's current picks stay listed.
export function buildLeagueSideOptions<O extends NamedTeam, L extends NamedTeam>(
  ownTeams: O[],
  affiliatedTeamIds: ReadonlySet<string> | null,
  leagueTeams: L[],
  other: SideIdentity | null | undefined,
  keep: { teamId?: string | null; leagueTeamId?: string | null } = {},
): { own: O[]; league: L[] } {
  const active = ownTeams.filter((team) => team.active)
  const affiliated = affiliatedTeamIds ? active.filter((team) => affiliatedTeamIds.has(team.id)) : active
  const ownBase = affiliated.length > 0 ? affiliated : active
  const own = excludeOtherSide(ownBase, other, 'team', keep.teamId)
  const ownNames = new Set(ownBase.map((team) => normaliseTeamName(team.name)))
  const league = excludeOtherSide(
    leagueTeams.filter((team) => team.id === keep.leagueTeamId || (team.active && !ownNames.has(normaliseTeamName(team.name)))),
    other,
    'leagueTeam',
    keep.leagueTeamId,
  )
  return { own, league }
}
