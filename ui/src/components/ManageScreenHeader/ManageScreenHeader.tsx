import type { ReactNode } from 'react'
import { Box, Button as MuiButton, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Link as RouterLink } from 'react-router-dom'
import { PageHeaderBand } from '../PageHeaderBand'

export interface ManageScreenHeaderProps {
  title: string
  // docs/specs/079-manager-shell-and-overview.md: no default. The manager shell's persistent menu
  // replaces "Back to Dashboard", so a screen shows a back link only when it passes a meaningful
  // `backTo` (a parent list or record); without one nothing is rendered.
  backTo?: string
  backLabel?: string
  // A primary page-level action (e.g. "Add Match"), rendered top-right alongside the title
  // instead of buried in a filter/toolbar row below. Additive/optional — every existing call site
  // that doesn't pass this keeps its current title-only header unchanged.
  action?: ReactNode
  // docs/specs/073-availability-hub.md: an optional slot between the title and `action` (the
  // Availability hub's view switch). On xs the row stacks title, middle, action. Omitted, the
  // markup is unchanged.
  middle?: ReactNode
  // docs/specs/083: an optional small caption directly under the title, in the same cell (e.g. the Availability
  // hub's "Showing: ..." scope). One line with an ellipsis from sm up, may wrap on a phone. Omitted, the markup is
  // unchanged.
  subtitle?: ReactNode
  // docs/specs/089: a small control right after the title on the same row (a list page's season pill). Omitted, the markup
  // is unchanged.
  titleAdornment?: ReactNode
}

// The page-title header (and optional back link) every bare /manage screen needs — RecordFormScreen's
// own back-button-plus-title only ships bundled with its field grid and actions bar, so a list or
// tree screen that isn't a create/edit form has no title of its own without this. Extracted after
// ClubContactList.tsx and SponsorList.tsx each hand-rolled the back button alone (title omitted
// by drift) while ClubStructure.tsx hand-rolled both — see docs/standards/frontend.md's
// >70%-duplication rule and the "every /manage screen has a page title" rule this component now
// exists to make structurally true rather than just documented.
export function ManageScreenHeader({ title, backTo, backLabel = 'Back', action, middle, subtitle, titleAdornment }: ManageScreenHeaderProps) {
  const titleNode = (
    <Typography variant="h5" component="h1" fontWeight={700}>
      {title}
    </Typography>
  )
  // The adornment (a season pill) sits on the title's row; without one the heading is the bare title as before.
  const heading = titleAdornment ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minWidth: 0 }}>
      {titleNode}
      {titleAdornment}
    </Box>
  ) : (
    titleNode
  )
  return (
    <PageHeaderBand>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
        {backTo && (
          <MuiButton
            component={RouterLink}
            to={backTo}
            variant="text"
            color="inherit"
            size="small"
            startIcon={<ArrowBackIcon fontSize="small" />}
            sx={{ ml: -1, color: 'text.secondary' }}
          >
            {backLabel}
          </MuiButton>
        )}

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            width: '100%',
          }}
        >
          {subtitle ? (
            <Box sx={{ minWidth: 0 }}>
              {heading}
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                data-testid="header-subtitle"
                sx={{ m: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: { xs: 'normal', sm: 'nowrap' } }}
              >
                {subtitle}
              </Typography>
            </Box>
          ) : (
            heading
          )}
          {middle}
          {action}
        </Box>
      </Box>
    </PageHeaderBand>
  )
}
