import type { Section } from '../../../api/sectionApi'

// docs/specs/136: the id of a section and of every section below it, so choosing a parent section includes its children's teams.
export function sectionIdsUnder(sections: Section[], sectionId: string): Set<string> {
  const ids = new Set<string>([sectionId])
  let grew = true
  while (grew) {
    grew = false
    for (const section of sections) {
      if (section.parentSectionId && ids.has(section.parentSectionId) && !ids.has(section.id)) {
        ids.add(section.id)
        grew = true
      }
    }
  }
  return ids
}
