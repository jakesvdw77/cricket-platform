import type { Section } from '../api/sectionApi'

// The sections with these ids plus every ancestor, in the club's own order, so a SectionTreeSelect built from a narrowed list
// stays connected (docs/specs/103 decision 22; used by the player stats page and the leaderboards). Selecting a parent still
// includes its descendants on the server.
export function sectionsWithAncestors(all: Section[], ids: Iterable<string>): Section[] {
  const byId = new Map(all.map((section) => [section.id, section]))
  const keep = new Set<string>()
  for (const id of ids) {
    let current = byId.get(id)
    while (current && !keep.has(current.id)) {
      keep.add(current.id)
      current = current.parentSectionId ? byId.get(current.parentSectionId) : undefined
    }
  }
  return all.filter((section) => keep.has(section.id))
}
