import { useMemo, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Box, ButtonBase, Chip, IconButton, Tooltip, Typography } from '@mui/material'
import { alpha, styled } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import type { Section } from '../../api/sectionApi'
import { ageRangeLabel } from '../../utils/ageRange'
import { buildSectionTree } from '../../utils/sectionTree'
import type { SectionTreeNode as TreeNode } from '../../utils/sectionTree'

export interface SectionOrgChartProps {
  sections: Section[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAddChild: (parentId: string) => void
  // Called when Escape is pressed while focus is inside the chart.
  onClearSelection?: () => void
  // Optional per-node toolbar slot, shown in a pill above the node. Return null for nodes that
  // should have none (SectionTreeEditor only returns its rename/remove pill for the selected one).
  renderNodeToolbar?: (section: Section) => ReactNode
}

// The scroller is the card-sized viewport: a wide tree scrolls sideways inside it, never the page.
// The inner row (see TreeCanvas) is `max-content` wide with auto side margins, so a narrow tree
// is centred and a wide one starts at the left edge instead of clipping its first node.
const TreeScroller = styled(Box, { shouldForwardProp: (prop) => prop !== 'toolbarRoom' })<{
  toolbarRoom: boolean
}>(({ toolbarRoom }) => ({
  overflowX: 'auto',
  overflowY: 'hidden',
  // Headroom for a selected root node's toolbar pill (top: -40) so the scroller's own
  // overflowY: hidden does not clip it.
  paddingTop: toolbarRoom ? 56 : 8,
  paddingBottom: 16,
}))

const TreeCanvas = styled(Box)({
  width: 'max-content',
  marginLeft: 'auto',
  marginRight: 'auto',
})

// The org-chart connector-line technique, ported from the approved Claude Design canvas: nested
// <ul>/<li> with ::before/::after pseudo-elements drawing the rail lines, each positioned
// relative to its own <li>.
const TreeList = styled('ul', { shouldForwardProp: (prop) => prop !== 'depth' })<{ depth: number }>(
  ({ theme, depth }) => ({
    display: 'flex',
    justifyContent: 'center',
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
      // Only the horizontal rail segment disappears at the row's outer edges, not the vertical
      // drop to the node: `::after` carries both, so only border-top-color is cleared.
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
  selectedId: string | null
  onSelect: (id: string) => void
  onAddChild: (parentId: string) => void
  renderNodeToolbar?: (section: Section) => ReactNode
}

function NodeCard({ node, selectedId, onSelect, onAddChild, renderNodeToolbar }: NodeCardProps) {
  const { section } = node
  const isSelected = section.id === selectedId
  const ageLabel = ageRangeLabel(section)
  const toolbar = renderNodeToolbar?.(section)

  return (
    <Box sx={{ position: 'relative', display: 'inline-block' }}>
      {toolbar && (
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
          {toolbar}
        </Box>
      )}

      <ButtonBase
        onClick={() => onSelect(section.id)}
        data-section-id={section.id}
        // Explicit aria-label so the accessible name does not shift when the age chip or
        // "Inactive" text renders.
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

interface Neighbours {
  parent: string | null
  firstChild: string | null
  prev: string | null
  next: string | null
}

function indexNeighbours(tree: TreeNode[]): Map<string, Neighbours> {
  const map = new Map<string, Neighbours>()
  const visit = (nodes: TreeNode[], parent: string | null) => {
    nodes.forEach((node, index) => {
      map.set(node.section.id, {
        parent,
        firstChild: node.children[0]?.section.id ?? null,
        prev: nodes[index - 1]?.section.id ?? null,
        next: nodes[index + 1]?.section.id ?? null,
      })
      visit(node.children, node.section.id)
    })
  }
  visit(tree, null)
  return map
}

// A visual org chart of a club's Section tree, built client-side from the flat `sections` array.
// Arrow keys move focus between nodes (Left/Right siblings, Up to the parent, Down to the first
// child); Enter or Space select the focused node (native button behaviour); Escape asks the
// parent to clear the selection.
export function SectionOrgChart({
  sections,
  selectedId,
  onSelect,
  onAddChild,
  onClearSelection,
  renderNodeToolbar,
}: SectionOrgChartProps) {
  const tree = useMemo(() => buildSectionTree(sections), [sections])
  const neighbours = useMemo(() => indexNeighbours(tree), [tree])
  const rootRef = useRef<HTMLDivElement>(null)

  const focusNode = (id: string | null) => {
    if (!id) {
      return
    }
    rootRef.current?.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(id)}"]`)?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      onClearSelection?.()
      return
    }
    const currentId = (event.target as HTMLElement).getAttribute?.('data-section-id')
    const current = currentId ? neighbours.get(currentId) : undefined
    if (!current) {
      return
    }
    const target = {
      ArrowLeft: current.prev,
      ArrowRight: current.next,
      ArrowUp: current.parent,
      ArrowDown: current.firstChild,
    }[event.key as 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown']
    if (target !== undefined) {
      event.preventDefault()
      focusNode(target)
    }
  }

  return (
    // The keydown handler only listens for keys bubbling up from the real buttons inside.
    <TreeScroller ref={rootRef} toolbarRoom={Boolean(renderNodeToolbar)} onKeyDown={handleKeyDown}>
      <TreeCanvas>
        <TreeBranch
          nodes={tree}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          onAddChild={onAddChild}
          renderNodeToolbar={renderNodeToolbar}
        />
      </TreeCanvas>
    </TreeScroller>
  )
}
