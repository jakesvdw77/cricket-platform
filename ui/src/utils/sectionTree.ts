import type { Section } from '../api/sectionApi'

// A Section node plus its own children, recursively — built once from the flat Section[] +
// parentSectionId array every /manage screen already fetches. Extracted out of
// SectionTreeEditor.tsx's own original private helper (docs/specs/025-club-structure.md) so a
// second real consumer (the new SectionTree picker, docs/roadmap.md's tree-picker follow-up) can
// reuse the exact same tree-building logic instead of duplicating it.
export interface SectionTreeNode {
  section: Section
  children: SectionTreeNode[]
}

export function buildSectionTree(sections: Section[]): SectionTreeNode[] {
  const byParent = new Map<string | null, Section[]>()
  sections.forEach((section) => {
    const key = section.parentSectionId
    const bucket = byParent.get(key)
    if (bucket) {
      bucket.push(section)
    } else {
      byParent.set(key, [section])
    }
  })

  function build(parentId: string | null): SectionTreeNode[] {
    return (byParent.get(parentId) ?? []).map((section) => ({
      section,
      children: build(section.id),
    }))
  }

  return build(null)
}
