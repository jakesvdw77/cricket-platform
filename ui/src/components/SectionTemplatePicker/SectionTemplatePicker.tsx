import { Box, Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import { Button } from '../Button'

// A node in a starter template's shape — deliberately just a name and optional children, the
// same minimal shape ClubStructure.tsx's createSection calls need. No id: a template is data
// describing what to CREATE, not real Section rows.
export interface SectionTemplateNode {
  name: string
  children?: SectionTemplateNode[]
}

export interface SectionTemplate {
  id: string
  title: string
  description: string
  roots: SectionTemplateNode[]
}

export interface SectionTemplatePickerProps {
  templates: SectionTemplate[]
  onChoose: (template: SectionTemplate) => void
  onStartBlank: () => void
  // The id of the template currently being built (its createSection calls are in flight) — shows
  // a per-card pending state and disables every other card while one is running, rather than
  // letting an admin fire two templates into the same tree at once.
  pendingTemplateId?: string | null
}

// Same nested-<ul>/<li> connector-line technique as SectionTreeEditor's TreeList/TreeItem, at a
// much smaller scale and with no interactivity (no add buttons, no click handlers) — this is a
// static preview, not a second tree editor. Kept as its own small copy rather than importing
// SectionTreeEditor's internals: those are sized and interactive for the real editor, and aren't
// exported for reuse (see that component's own file for the full-scale version this mirrors).
const MiniTreeList = styled('ul', { shouldForwardProp: (prop) => prop !== 'depth' })<{ depth: number }>(
  ({ theme, depth }) => ({
    display: 'flex',
    justifyContent: 'center',
    margin: 0,
    padding: 0,
    paddingTop: depth === 0 ? 0 : 12,
    position: 'relative',
    ...(depth > 0 && {
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: '50%',
        borderLeft: `1px solid ${theme.palette.divider}`,
        width: 0,
        height: 12,
      },
    }),
  }),
)

const MiniTreeItem = styled('li', { shouldForwardProp: (prop) => prop !== 'depth' })<{ depth: number }>(
  ({ theme, depth }) => ({
    listStyleType: 'none',
    position: 'relative',
    padding: depth === 0 ? '0 5px' : '12px 5px 0 5px',
    textAlign: 'center',
    ...(depth > 0 && {
      '&::before, &::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        right: '50%',
        borderTop: `1px solid ${theme.palette.divider}`,
        width: '50%',
        height: 12,
      },
      '&::after': {
        right: 'auto',
        left: '50%',
        borderLeft: `1px solid ${theme.palette.divider}`,
      },
      '&:only-child::before, &:only-child::after': { display: 'none' },
      '&:only-child': { paddingTop: 0 },
      // Only clear the horizontal rail (border-top), never the shorthand borderColor — ::after
      // also carries the vertical drop-line (border-left) down to this node's own children, and
      // zeroing both orphaned the last child's connector down to e.g. "Women" → "1st XI".
      '&:first-of-type::before': { borderTopColor: 'transparent' },
      '&:last-of-type::after': { borderTopColor: 'transparent' },
    }),
  }),
)

const MiniNode = styled(Box)(({ theme }) => ({
  display: 'inline-block',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: '3px 7px',
  fontSize: 10,
  lineHeight: 1.4,
  fontWeight: 600,
  color: theme.palette.text.primary,
  background: theme.palette.background.paper,
  whiteSpace: 'nowrap',
}))

function MiniTreeBranch({ nodes, depth }: { nodes: SectionTemplateNode[]; depth: number }) {
  if (nodes.length === 0) {
    return null
  }
  return (
    <MiniTreeList depth={depth}>
      {nodes.map((node) => (
        <MiniTreeItem depth={depth} key={node.name}>
          <MiniNode>{node.name}</MiniNode>
          {node.children && node.children.length > 0 && <MiniTreeBranch nodes={node.children} depth={depth + 1} />}
        </MiniTreeItem>
      ))}
    </MiniTreeList>
  )
}

// Shown in place of SectionTreeEditor when a club has zero sections — docs/specs/
// 025-club-structure.md's User Stories: a few genuinely different, named, previewed starting
// shapes (not one hardcoded default), plus starting blank as an equally-valid peer option.
export function SectionTemplatePicker({ templates, onChoose, onStartBlank, pendingTemplateId }: SectionTemplatePickerProps) {
  const isBuilding = Boolean(pendingTemplateId)

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: { xs: 2, sm: 3 } }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Build your club&rsquo;s section tree
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Pick a starting shape close to how your club is actually organised — every node stays fully yours to
          rename, restructure, or remove afterward.
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
        {templates.map((template) => (
          <Box
            key={template.id}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              // Without this, a grid item won't shrink below its content's intrinsic width, so a
              // wide diagram (e.g. "Traditional club"'s three root branches) forces this whole
              // card — and the page itself — wider than the viewport instead of the diagram's own
              // overflowX: 'auto' scrolling within its bounds. Same class of bug the mobile-first
              // rule in docs/standards/frontend.md exists to catch.
              minWidth: 0,
            }}
          >
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {template.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {template.description}
              </Typography>
            </Box>

            <Box sx={{ overflowX: 'auto', display: 'flex', justifyContent: 'center', py: 0.5 }}>
              <MiniTreeBranch nodes={template.roots} depth={0} />
            </Box>

            <Button variant="secondary" size="sm" onClick={() => onChoose(template)} disabled={isBuilding}>
              {pendingTemplateId === template.id ? 'Building…' : 'Use this template'}
            </Button>
          </Box>
        ))}
      </Box>

      <Box sx={{ textAlign: 'center', mt: 3 }}>
        <Button variant="ghost" size="sm" onClick={onStartBlank} disabled={isBuilding}>
          Or start blank and build it yourself →
        </Button>
      </Box>
    </Box>
  )
}
