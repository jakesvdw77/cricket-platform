import type { Section } from '../api/sectionApi'

// Walks parentSectionId up the flat list to build a root-first ancestor name trail for the
// breadcrumb — moved verbatim from ClubStructure.tsx's own private helper (docs/specs/
// 027-team-profile.md) so it has one implementation instead of becoming two once Team screens
// need it too (docs/standards/frontend.md's reuse rule). Callers render this trail, plus the
// section's own name, however suits their layout — this function only ever returns ancestors.
export function breadcrumbFor(section: Section, sectionsById: Map<string, Section>): string[] {
  const trail: string[] = []
  let current = section.parentSectionId ? sectionsById.get(section.parentSectionId) : undefined
  while (current) {
    trail.unshift(current.name)
    current = current.parentSectionId ? sectionsById.get(current.parentSectionId) : undefined
  }
  return trail
}
