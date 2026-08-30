import { Box, Button as MuiButton, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Link as RouterLink } from 'react-router-dom'

export interface ManageScreenHeaderProps {
  title: string
  backTo?: string
  backLabel?: string
}

// The back-link + page-title header every bare /manage screen needs — GridNavShell (unlike
// AppShell's sidebar or BottomTabShell's tab bar) has no persistent nav, and RecordFormScreen's
// own back-button-plus-title only ships bundled with its field grid and actions bar, so a list or
// tree screen that isn't a create/edit form has no title of its own without this. Extracted after
// ClubContactList.tsx and SponsorList.tsx each hand-rolled the back button alone (title omitted
// by drift) while ClubStructure.tsx hand-rolled both — see docs/standards/frontend.md's
// >70%-duplication rule and the "every /manage screen has a page title" rule this component now
// exists to make structurally true rather than just documented.
export function ManageScreenHeader({ title, backTo = '/manage', backLabel = 'Back to Dashboard' }: ManageScreenHeaderProps) {
  return (
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

      <Typography variant="h6" component="h1" fontWeight={600}>
        {title}
      </Typography>
    </Box>
  )
}
