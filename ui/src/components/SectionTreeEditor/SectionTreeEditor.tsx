import { useMemo } from 'react'
import { Box, ButtonBase, Chip, IconButton, Tooltip, Typography } from '@mui/material'
import { alpha, styled } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { Button } from '../Button'
import type { Section } from '../../api/sectionApi'
import { buildSectionTree } from '../../utils/sectionTree'
import type { SectionTreeNode as TreeNode } from '../../utils/sectionTree'

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

function ageRangeLabel(section: Section): string | null {
  if (section.minAge != null && section.maxAge != null) {
    return `${section.minAge}–${section.maxAge}`
  }
  if (section.minAge != null) {
    return `${section.minAge}+`
  }
  if (section.maxAge != null) {
    return `Under ${section.maxAge}`
  }
  return null
}

// Horizontally-scrollable so an arbitrarily wide/deep tree never forces page-level horizontal
// scroll on mobile — the container scrolls, not the page (docs/specs/025-club-structure.md's
// UI Requirements).
const TreeScroller = styled(Box)({
  overflowX: 'auto',
  overflowY: 'hidden',
  // A selected root-level (depth 0) node's rename/remove toolbar sits at `top: -40` relative to
  // the node — 40px of clearance plus the toolbar's own ~34px height needs ~48px+ of headroom
  // above the node. The old value (24) left the topmost row's toolbar clipped by this container's
  // own `overflowY: hidden`, which also made it unhoverable (a real bug an E2E run caught: the
  // hover target resolved but the click landed on whatever painted behind the clipped area).
  paddingTop: 56,
  paddingBottom: 12,
})

// The org-chart connector-line technique, ported from the approved Claude Design canvas
// (Main.dc.html/Mobile.dc.html) — nested <ul>/<li> with ::before/::after pseudo-elements drawing
// the tree's horizontal/vertical rail lines. Every pseudo-element is positioned relative to its
// own <li>, so this works with flexbox-laid-out siblings rather than the classic float-based
// version the technique is usually written with.
const TreeList = styled('ul', { shouldForwardProp: (prop) => prop !== 'depth' })<{ depth: number }>(
  ({ theme, depth }) => ({
    display: 'flex',
    // Centering a flex row that's wider than its scrollable ancestor clips the start-side
    // overflow permanently — scrollLeft can't go negative to reach it, so content left of the
    // centered midpoint becomes unreachable (a real bug a live screenshot caught: the leftmost
    // root nodes were cut off with no way to scroll to them). Only the root row (depth 0) needs
    // this fix — nested rows must stay centered so they align under their own parent's connector
    // drop-line (the `ul::before` below).
    justifyContent: depth === 0 ? 'flex-start' : 'center',
    margin: 0,
    padding: 0,
    paddingTop: depth === 0 ? 0 : 20,
    position: 'relative',
    ...(depth > 0 && {
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: '50%',
        borderLeft: `1px solid ${theme.palette.divider}`,
        width: 0,
        height: 20,
      },
    }),
  }),
)

const TreeItem = styled('li', { shouldForwardProp: (prop) => prop !== 'depth' })<{ depth: number }>(
  ({ theme, depth }) => ({
    listStyleType: 'none',
    position: 'relative',
    padding: depth === 0 ? '0 12px' : '20px 12px 0 12px',
    textAlign: 'center',
    ...(depth > 0 && {
      '&::before, &::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        right: '50%',
        borderTop: `1px solid ${theme.palette.divider}`,
        width: '50%',
        height: 20,
      },
      '&::after': {
        right: 'auto',
        left: '50%',
        borderLeft: `1px solid ${theme.palette.divider}`,
      },
      '&:only-child::before, &:only-child::after': {
        display: 'none',
      },
      '&:only-child': {
        paddingTop: 0,
      },
      // Only the horizontal rail segment should disappear at the row's outer edges — NOT the
      // vertical drop down to the node itself. `::before` only ever carries a top border (the
      // horizontal segment), so nulling its color outright is safe. `::after` carries BOTH the
      // horizontal segment (border-top) AND the vertical drop (border-left) on the same element;
      // the earlier `borderColor` shorthand zeroed every side, silently killing the last child's
      // own drop-line too and leaving it looking disconnected from the tree above it — a real bug
      // caught from a live screenshot. Target border-top-color only so border-left is untouched.
      '&:first-of-type::before': {
        borderTopColor: 'transparent',
      },
      '&:last-of-type::after': {
        borderTopColor: 'transparent',
      },
    }),
  }),
)

interface NodeCardProps {
  node: TreeNode
  sections: Section[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAddChild: (parentId: string | null) => void
  onRemove: (id: string) => void
  onRenameStart?: (id: string) => void
}

function NodeCard({ node, sections, selectedId, onSelect, onAddChild, onRemove, onRenameStart }: NodeCardProps) {
  const { section } = node
  const isSelected = section.id === selectedId
  const childCount = activeChildCount(section.id, sections)
  const canRemove = section.active && childCount === 0
  const ageLabel = ageRangeLabel(section)

  return (
    <Box sx={{ position: 'relative', display: 'inline-block' }}>
      {isSelected && (
        <Box
          sx={{
            position: 'absolute',
            top: -40,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 999,
            boxShadow: 1,
            zIndex: 1,
          }}
        >
          <IconButton
            size="small"
            aria-label={`Rename ${section.name}`}
            onClick={() => onRenameStart?.(section.id)}
          >
            <EditIcon fontSize="inherit" />
          </IconButton>
          <Tooltip
            title={
              canRemove
                ? ''
                : !section.active
                  ? 'This section is already inactive'
                  : `Has ${childCount} active sub-section${childCount === 1 ? '' : 's'} — deactivate ${childCount === 1 ? 'it' : 'them'} first`
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
        </Box>
      )}

      <ButtonBase
        onClick={() => onSelect(section.id)}
        // Explicit aria-label rather than letting the accessible name fall out of visible text
        // content — otherwise it shifts (gains the age-range chip's text, or "Inactive") as soon
        // as those render, which is both a poor a11y name and an unstable locator target.
        aria-label={section.name}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          px: '18px',
          py: '10px',
          border: '1px solid',
          borderColor: isSelected ? 'primary.main' : 'divider',
          borderWidth: isSelected ? 2 : 1,
          borderRadius: 1,
          bgcolor: isSelected ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'background.paper',
          opacity: section.active ? 1 : 0.55,
          minWidth: 96,
        }}
      >
        <Typography fontSize={14} fontWeight={600}>
          {section.name}
        </Typography>
        {!section.active && (
          <Typography variant="caption" color="text.secondary">
            Inactive
          </Typography>
        )}
        {ageLabel && (
          <Chip
            size="small"
            label={ageLabel}
            sx={{
              height: 20,
              fontSize: 11,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
              color: 'primary.dark',
            }}
          />
        )}
      </ButtonBase>

      <Tooltip title="Add a child section">
        <IconButton
          size="small"
          aria-label={`Add a child section under ${section.name}`}
          onClick={() => onAddChild(section.id)}
          sx={{
            position: 'absolute',
            bottom: -11,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 22,
            height: 22,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) },
          }}
        >
          <AddIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

interface TreeBranchProps extends Omit<NodeCardProps, 'node'> {
  nodes: TreeNode[]
  depth: number
}

function TreeBranch({ nodes, depth, ...handlers }: TreeBranchProps) {
  if (nodes.length === 0) {
    return null
  }

  return (
    <TreeList depth={depth}>
      {nodes.map((node) => (
        <TreeItem depth={depth} key={node.section.id}>
          <NodeCard node={node} {...handlers} />
          {node.children.length > 0 && <TreeBranch nodes={node.children} depth={depth + 1} {...handlers} />}
        </TreeItem>
      ))}
    </TreeList>
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
  const tree = useMemo(() => buildSectionTree(sections), [sections])

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

      {tree.length === 0 ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
          <Typography variant="body2" color="text.secondary">
            No sections yet — add a top-level section to get started.
          </Typography>
        </Box>
      ) : (
        <TreeScroller sx={{ flex: 1, minHeight: 0 }}>
          <TreeBranch
            nodes={tree}
            depth={0}
            sections={sections}
            selectedId={selectedId}
            onSelect={onSelect}
            onAddChild={onAddChild}
            onRemove={onRemove}
            onRenameStart={onRenameStart}
          />
        </TreeScroller>
      )}
    </Box>
  )
}
