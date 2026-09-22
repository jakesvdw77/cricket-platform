import type { ReactNode } from 'react'
import { Box, Button as MuiButton, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Link as RouterLink } from 'react-router-dom'
import { PageHeaderBand } from '../PageHeaderBand'

export interface ManageScreenHeaderProps {
  title: string
  backTo?: string
  backLabel?: string
  // A primary page-level action (e.g. "Add Match"), rendered top-right alongside the title
  // instead of buried in a filter/toolbar row below. Additive/optional — every existing call site
  // that doesn't pass this keeps its current title-only header unchanged.
  action?: ReactNode
}

// The back-link + page-title header every bare /manage screen needs — GridNavShell (unlike
// AppShell's sidebar or BottomTabShell's tab bar) has no persistent nav, and RecordFormScreen's
// own back-button-plus-title only ships bundled with its field grid and actions bar, so a list or
// tree screen that isn't a create/edit form has no title of its own without this. Extracted after
// ClubContactList.tsx and SponsorList.tsx each hand-rolled the back button alone (title omitted
// by drift) while ClubStructure.tsx hand-rolled both — see docs/standards/frontend.md's
// >70%-duplication rule and the "every /manage screen has a page title" rule this component now
// exists to make structurally true rather than just documented.
export function ManageScreenHeader({ title, backTo = '/manage', backLabel = 'Back to Dashboard', action }: ManageScreenHeaderProps) {
  return (
    <PageHeaderBand>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
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
          <Typography variant="h6" component="h1" fontWeight={700}>
            {title}
          </Typography>
          {action}
        </Box>
      </Box>
    </PageHeaderBand>
  )
}
