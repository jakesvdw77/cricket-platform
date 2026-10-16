import type { Section } from '../api/sectionApi'

// "Seniors > Under 15": the section's own name preceded by its parents' (docs/specs/025-club-structure.md's tree, held as a flat
// list with parent pointers). Empty when the section is unknown. A loop in the data cannot hang it.
export function sectionPath(sections: Section[], sectionId: string | null | undefined): string {
  const byId = new Map(sections.map((section) => [section.id, section]))
  const names: string[] = []
  const seen = new Set<string>()
  let current = sectionId ? byId.get(sectionId) : undefined
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    names.unshift(current.name)
    current = current.parentSectionId ? byId.get(current.parentSectionId) : undefined
  }
  return names.join(' > ')
}
