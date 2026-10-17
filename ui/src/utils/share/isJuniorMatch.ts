import type { League } from '../../api/leagueApi'
import type { Section } from '../../api/sectionApi'

// docs/specs/114-share-result.md (Default and junior lock): is this a junior match, so First names as initials is locked on?
// Pure; no React. The one place the rule lives.

// A league or section with a maxAge at or below this is junior; "U19" and above are adult.
export const JUNIOR_MAX_AGE = 18

export type JuniorReason = 'LEAGUE_MAX_AGE' | 'SECTION_MAX_AGE' | 'SECTION_NAME' | 'UNAVAILABLE'

export interface JuniorMatchInput {
  // null: the match has no league (a friendly). undefined: the league could not be loaded (fails safe to junior).
  league: Pick<League, 'maxAge'> | null | undefined
  // The club's flat section list; undefined: it could not be loaded (fails safe to junior).
  sections: Pick<Section, 'id' | 'parentSectionId' | 'name' | 'maxAge'>[] | undefined
  // The match's OWN teams (one, or two in a derby), by section.
  teams: { sectionId: string | null | undefined }[]
}

export interface JuniorMatchResult {
  junior: boolean
  reason: JuniorReason | null
}

type SectionLike = NonNullable<JuniorMatchInput['sections']>[number]

// The section and its ancestors, nearest first. A loop in the data cannot hang it.
function sectionChain(sections: SectionLike[], sectionId: string | null | undefined): SectionLike[] {
  const byId = new Map(sections.map((section) => [section.id, section]))
  const chain: SectionLike[] = []
  const seen = new Set<string>()
  let current = sectionId ? byId.get(sectionId) : undefined
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.push(current)
    current = current.parentSectionId ? byId.get(current.parentSectionId) : undefined
  }
  return chain
}

// True when the section is missing from the list (inactive, removed, or never set), or a parent it names is: its age cannot be known.
function pathUnresolved(sections: SectionLike[], chain: SectionLike[], sectionId: string | null | undefined): boolean {
  if (!sectionId || chain.length === 0) return true
  const last = chain[chain.length - 1]
  return Boolean(last.parentSectionId) && !sections.some((section) => section.id === last.parentSectionId)
}

const hasAge = (maxAge: number | null | undefined): maxAge is number => maxAge !== null && maxAge !== undefined

export function isJuniorMatch(input: JuniorMatchInput): JuniorMatchResult {
  if (input.league === undefined || input.sections === undefined) return { junior: true, reason: 'UNAVAILABLE' }

  // Rule 1: the league's own enforced age cap decides, either way.
  const leagueMax = input.league?.maxAge
  if (hasAge(leagueMax)) {
    return leagueMax <= JUNIOR_MAX_AGE ? { junior: true, reason: 'LEAGUE_MAX_AGE' } : { junior: false, reason: null }
  }

  const all = input.sections as SectionLike[]
  const chains = input.teams.map((team) => sectionChain(all, team.sectionId))
  const sections = chains.flat()

  // Rule 2: a section on either own team's path with an age cap at or below the threshold.
  if (sections.some((section) => hasAge(section.maxAge) && section.maxAge <= JUNIOR_MAX_AGE)) {
    return { junior: true, reason: 'SECTION_MAX_AGE' }
  }

  // No age settled it. A match with no own team, or an own team whose section (or a parent of it) cannot be found, is unknown,
  // not adult: fail safe to junior.
  if (input.teams.length === 0 || chains.some((chain, index) => pathUnresolved(all, chain, input.teams[index].sectionId))) {
    return { junior: true, reason: 'UNAVAILABLE' }
  }

  // Rule 3, only when there is no age data anywhere: a section named "Juniors" on the path.
  if (!sections.some((section) => hasAge(section.maxAge))) {
    if (sections.some((section) => section.name.trim().toLowerCase() === 'juniors')) {
      return { junior: true, reason: 'SECTION_NAME' }
    }
  }
  return { junior: false, reason: null }
}
