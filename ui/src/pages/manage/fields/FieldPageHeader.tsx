import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Button as MuiButton, Chip, Link as MuiLink, Stack, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import { compactButtonSx } from '../../../components/Button'
import { LogoAvatar } from '../../../components/LogoAvatar'
import { ManageMenu } from '../../../components/ManageMenu'
import type { ManageMenuItem } from '../../../components/ManageMenu'
import { PageHeaderBand } from '../../../components/PageHeaderBand'
import { badgeSx } from '../../../components/RecordCard'
import { useBackLink } from '../../../hooks/useReturnTo'
import { pageTitleSx } from '../../../theme'
import { fieldStatusBadge, fieldStatusOf } from '../../../utils/fieldStatus'
import { initialsFromName } from '../../../utils/initials'
import type { PlayingArea } from '../../../api/playingAreaApi'

export interface FieldPageHeaderProps {
  field: PlayingArea
  // The list this page belongs to when no returnTo says otherwise ("/manage/fixtures/fields" or "/admin/fields").
  listPath: string
  // The items of the one Manage Field menu (`fieldMenuItems` with placement 'page').
  menuItems: ManageMenuItem[]
  // Extra content under the title (the platform admin has none today).
  children?: ReactNode
}

// docs/specs/134 and docs/standards/page-anatomy.md sections 1 and 6b: the header of a field page, shared by the manager's page and
// the platform admin's. Top row: the quiet Back alone. Title row: the field's soft green initials tile, the name in the record
// title style (own capitals), ONE verification badge inline, then ONE filled Manage Field menu at MANAGE_BUTTON_WIDTH (full width
// on a phone). Open in maps is an inline link under the title (icon then text), and also a menu item. No Share: a field has none.
export function FieldPageHeader({ field, listPath, menuItems, children }: FieldPageHeaderProps) {
  const back = useBackLink(listPath, 'Back to Fields')
  const badge = fieldStatusBadge(fieldStatusOf(field))

  return (
    <PageHeaderBand>
      <Stack spacing={2}>
        <Box data-testid="field-header-top-row" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <MuiButton
            component={RouterLink}
            to={back.to ?? listPath}
            variant="text"
            color="inherit"
            size="small"
            startIcon={<ArrowBackIcon fontSize="small" />}
            sx={{ ...compactButtonSx, ml: -1, color: 'text.secondary' }}
          >
            {back.label}
          </MuiButton>
        </Box>

        <Box data-testid="field-header-title-row" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2, rowGap: 1.5, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 }, minWidth: 0, flex: '1 1 auto' }}>
            <LogoAvatar variant="rounded" size={64} fontSize="1.25rem" sx={{ width: { xs: 52, md: 64 }, height: { xs: 52, md: 64 }, borderRadius: 1.5 }}>
              {initialsFromName(field.name)}
            </LogoAvatar>
            <Stack spacing={0.75} sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.25, rowGap: 0.5, minWidth: 0 }}>
                <Typography
                  variant="h4"
                  component="h1"
                  sx={{ ...pageTitleSx, fontSize: { xs: 26, md: 32 }, lineHeight: 1.1, letterSpacing: '0.02em', textTransform: 'none', overflowWrap: 'anywhere' }}
                >
                  {field.name}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap aria-label="Field badges" sx={{ flex: 'none' }}>
                  <Chip size="small" label={badge.label} sx={badgeSx(badge.tone)} data-testid="field-status-badge" />
                </Stack>
              </Box>
              {field.mapUrl && (
                <MuiLink
                  href={field.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  data-testid="field-maps-link"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontWeight: 600, fontSize: '0.875rem', width: 'fit-content' }}
                >
                  <MapOutlinedIcon sx={{ fontSize: 18 }} />
                  Open in maps
                </MuiLink>
              )}
              {children}
            </Stack>
          </Box>
          <Box data-testid="field-header-actions" sx={{ display: 'flex', flex: { xs: '1 1 100%', sm: 'none' }, ml: { sm: 'auto' } }}>
            <ManageMenu label="Manage Field" testId="manage-field" fixedWidth groups={[{ id: 'field', heading: 'Field', items: menuItems }]} />
          </Box>
        </Box>
      </Stack>
    </PageHeaderBand>
  )
}
