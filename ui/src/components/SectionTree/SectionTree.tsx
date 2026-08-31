import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Typography } from '@mui/material'
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import type { Section } from '../../api/sectionApi'
import { buildSectionTree } from '../../utils/sectionTree'
import type { SectionTreeNode } from '../../utils/sectionTree'

export interface SectionTreeProps {
  sections: Section[]
  // Single-select — every real consumer (TeamForm's own Section field, a player's section
  // tagging) only ever picks one node at a time. `null` when nothing's selected yet.
  selectedId?: string | null
  onSelect: (sectionId: string) => void
  // Ids to render disabled (not hidden) rather than remove from the tree — e.g. a section a
  // player is already tagged to. Hiding a node outright would orphan its children visually; a
  // disabled node keeps the tree's real shape intact while making clear it isn't pickable here.
  disabledIds?: Set<string>
  emptyMessage?: string
}

// A real, expand/collapse tree rendering of the club's actual Section hierarchy — replaces a flat
// alphabetical-order list, which is genuinely ambiguous once two different branches reuse the same
// name (e.g. "U13" under both Boys and Girls) — real user feedback on the first version of both
// TeamForm's Section field and the Players Sections-tagging dialog, which used a bare flat
// Select/Autocomplete with no way to tell which "U13" was which. Every node starts expanded (see
// SectionTreeSelect/PlayerFormPage) since a club's section tree is small enough that scanning it
// fully beats hunting for a collapsed branch.
export function SectionTree({ sections, selectedId, onSelect, disabledIds, emptyMessage }: SectionTreeProps) {
  const tree = useMemo(() => buildSectionTree(sections), [sections])
  const allIds = useMemo(() => sections.map((section) => section.id), [sections])

  if (sections.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
        {emptyMessage ?? 'No sections yet.'}
      </Typography>
    )
  }

  function renderNodes(nodes: SectionTreeNode[]): ReactNode {
    return nodes.map(({ section, children }) => (
      <TreeItem key={section.id} itemId={section.id} label={section.name} disabled={disabledIds?.has(section.id)}>
        {children.length > 0 ? renderNodes(children) : undefined}
      </TreeItem>
    ))
  }

  return (
    <SimpleTreeView
      aria-label="Section"
      multiSelect={false}
      selectedItems={selectedId ?? null}
      onSelectedItemsChange={(_event, itemId) => {
        if (itemId) {
          onSelect(itemId)
        }
      }}
      defaultExpandedItems={allIds}
    >
      {renderNodes(tree)}
    </SimpleTreeView>
  )
}
