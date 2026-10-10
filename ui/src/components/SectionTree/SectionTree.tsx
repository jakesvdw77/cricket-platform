import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Box, Chip, IconButton, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import type { Section } from '../../api/sectionApi'
import { ageRangeLabel } from '../../utils/ageRange'
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
  // docs/specs/094: opt-in extras for the Club profile's phone list. Both default off, so every other consumer
  // (SectionTreeSelect, the player and team forms) renders exactly as before.
  // Shows the age range (ageRangeLabel) as a small chip after the name when the section has one.
  showAgeChip?: boolean
  // Shows an inline round "+" (32 px) per row that adds a child section under it.
  onAddChild?: (sectionId: string) => void
}

// A real, expand/collapse tree rendering of the club's actual Section hierarchy — replaces a flat
// alphabetical-order list, which is genuinely ambiguous once two different branches reuse the same
// name (e.g. "U13" under both Boys and Girls) — real user feedback on the first version of both
// TeamForm's Section field and the Players Sections-tagging dialog, which used a bare flat
// Select/Autocomplete with no way to tell which "U13" was which. Every node starts expanded (see
// SectionTreeSelect/PlayerFormPage) since a club's section tree is small enough that scanning it
// fully beats hunting for a collapsed branch.
export function SectionTree({ sections, selectedId, onSelect, disabledIds, emptyMessage, showAgeChip = false, onAddChild }: SectionTreeProps) {
  const tree = useMemo(() => buildSectionTree(sections), [sections])
  const allIds = useMemo(() => sections.map((section) => section.id), [sections])

  if (sections.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
        {emptyMessage ?? 'No sections yet.'}
      </Typography>
    )
  }

  function renderLabel(section: Section): ReactNode {
    const age = showAgeChip ? ageRangeLabel(section) : null
    if (!age && !onAddChild) {
      return section.name
    }
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 36 }}>
        <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {section.name}
        </Box>
        {age && <Chip size="small" label={age} variant="outlined" sx={{ height: 22, fontWeight: 600, flex: 'none' }} />}
        {onAddChild && (
          <IconButton
            size="small"
            aria-label={`Add a child section under ${section.name}`}
            // The row is the tree item: stop the click (and the key press the tree listens for) selecting it.
            onClick={(event) => {
              event.stopPropagation()
              onAddChild(section.id)
            }}
            onKeyDown={(event) => event.stopPropagation()}
            sx={{ ml: 'auto', flex: 'none', width: 32, height: 32, border: 1, borderColor: 'divider', color: 'primary.main' }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    )
  }

  function renderNodes(nodes: SectionTreeNode[]): ReactNode {
    return nodes.map(({ section, children }) => (
      <TreeItem key={section.id} itemId={section.id} label={renderLabel(section)} disabled={disabledIds?.has(section.id)}>
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
