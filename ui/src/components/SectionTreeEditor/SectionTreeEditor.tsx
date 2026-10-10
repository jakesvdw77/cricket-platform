import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { Button } from '../Button'
import type { Section } from '../../api/sectionApi'
import { SectionOrgChart } from '../SectionOrgChart'

export interface SectionTreeEditorProps {
  sections: Section[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAddChild: (parentId: string | null) => void
  onRemove: (id: string) => void
  // Rename is inline in SectionDetailPanel's own Name field — this only signals intent (this
  // toolbar shows on an already-selected node, so it can't itself change the selection). The
  // parent uses it to focus the detail panel's Name field, since reselecting the same node
  // wouldn't otherwise do anything observable.
  onRenameStart?: (id: string) => void
}

// A node's own active-children count, derived client-side from the same flat sections array —
// no extra API call needed (docs/specs/025-club-structure.md's Data Model Changes deactivate
// rule: a node can't be removed while any direct child is still active).
function activeChildCount(sectionId: string, sections: Section[]): number {
  return sections.filter((section) => section.parentSectionId === sectionId && section.active).length
}

interface NodeToolbarProps {
  section: Section
  sections: Section[]
  onRemove: (id: string) => void
  onRenameStart?: (id: string) => void
}

function NodeToolbar({ section, sections, onRemove, onRenameStart }: NodeToolbarProps) {
  const childCount = activeChildCount(section.id, sections)
  const canRemove = section.active && childCount === 0

  return (
    <>
      <IconButton size="small" aria-label={`Rename ${section.name}`} onClick={() => onRenameStart?.(section.id)}>
        <EditIcon fontSize="inherit" />
      </IconButton>
      <Tooltip
        title={
          canRemove
            ? ''
            : !section.active
              ? 'This section is already inactive'
              : `Has ${childCount} active sub-section${childCount === 1 ? '' : 's'}: deactivate ${childCount === 1 ? 'it' : 'them'} first`
        }
      >
        <span>
          <IconButton
            size="small"
            aria-label={`Remove ${section.name}`}
            disabled={!canRemove}
            onClick={() => onRemove(section.id)}
            sx={{ color: canRemove ? 'error.main' : undefined }}
          >
            <DeleteOutlineIcon fontSize="inherit" />
          </IconButton>
        </span>
      </Tooltip>
    </>
  )
}

// The one genuinely new component in docs/specs/025-club-structure.md — a visual, click-to-edit
// org-chart for a club's self-referential Section tree. Builds the tree client-side from the flat
// `sections` array (group by parentSectionId, root = parentSectionId === null); the connector-line
// CSS is ported from the approved Claude Design canvas (see the styled() definitions above).
export function SectionTreeEditor({
  sections,
  selectedId,
  onSelect,
  onAddChild,
  onRemove,
  onRenameStart,
}: SectionTreeEditorProps) {
  const hasSections = sections.length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Section tree
        </Typography>
        <Button variant="secondary" size="sm" startIcon={<AddIcon />} onClick={() => onAddChild(null)}>
          Add top-level section
        </Button>
      </Box>

      {!hasSections ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
          <Typography variant="body2" color="text.secondary">
            No sections yet — add a top-level section to get started.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <SectionOrgChart
            sections={sections}
            selectedId={selectedId}
            onSelect={onSelect}
            onAddChild={onAddChild}
            renderNodeToolbar={(section) =>
              section.id === selectedId ? (
                <NodeToolbar section={section} sections={sections} onRemove={onRemove} onRenameStart={onRenameStart} />
              ) : null
            }
          />
        </Box>
      )}
    </Box>
  )
}
