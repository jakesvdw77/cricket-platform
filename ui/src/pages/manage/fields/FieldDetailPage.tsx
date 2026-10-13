import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Box, Button as MuiButton, Chip, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import { EmptyState } from '../../../components/EmptyState'
import { PageHeaderBand } from '../../../components/PageHeaderBand'
import { avatarSx, badgeSx } from '../../../components/RecordCard'
import { getPlayingArea, playingAreasKey } from '../../../api/playingAreaApi'
import { useFieldHomeLink } from '../../../hooks/useFieldHomeLink'
import { fieldEditState, fieldStatusBadge, fieldStatusOf } from '../../../utils/fieldStatus'
import { FIELD_CATEGORY_LABEL } from '../../../utils/fieldLabels'
import { initialsFromName } from '../../../utils/initials'
import { FieldInfoCards } from './FieldInfoCards'
import { FieldKeyFigures } from './FieldKeyFigures'
import { FieldNotice } from './FieldNotice'

// docs/specs/099-fields-directory.md (4): a field's page, on the Player page's shape. Back on the left of the top row with the
// page actions on the right (the filled primary Edit, which is disabled with the reason when this club cannot edit the
// field, and Open in maps), the title below with the verification badge, the persistent unverified notice, a key-figure
// strip, then equal-height cards (Address, Details, Verification).
export default function FieldDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { fieldId } = useParams<{ fieldId?: string }>()
  const homeLink = useFieldHomeLink(clubId)

  const { data: field, isPending, isError } = useQuery({
    queryKey: [...playingAreasKey(clubId ?? ''), 'detail', fieldId],
    queryFn: () => getPlayingArea(clubId as string, fieldId as string),
    enabled: Boolean(clubId) && Boolean(fieldId),
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isPending) {
    return null
  }

  if (isError || !field) {
    return <EmptyState title="Couldn't load this field" description="Something went wrong loading this field. Please try again." />
  }

  const badge = fieldStatusBadge(fieldStatusOf(field))
  const edit = fieldEditState(field, clubId)
  const linkedHome = Boolean(field.linkedHome)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeaderBand>
        <MuiButton
          component={RouterLink}
          to="/manage/fixtures/fields"
          variant="text"
          color="inherit"
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          sx={{ mb: 1, ml: -1, color: 'text.secondary' }}
        >
          Back to Fields
        </MuiButton>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Stack direction="row" alignItems="center" spacing={{ xs: 1.75, md: 2 }} sx={{ minWidth: 0 }}>
            <Avatar
              variant="rounded"
              sx={(theme) => ({
                ...avatarSx(80, '1.6rem'),
                boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.18)}`,
                [theme.breakpoints.down('md')]: { width: 72, height: 72, fontSize: '1.4rem' },
              })}
            >
              {initialsFromName(field.name)}
            </Avatar>
            <Stack spacing={1} sx={{ minWidth: 0 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: { xs: '1.4rem', md: '1.75rem' }, overflowWrap: 'anywhere' }}
              >
                {field.name}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={badge.label} sx={badgeSx(badge.tone)} data-testid="field-status-badge" />
                <Chip size="small" variant="outlined" label={FIELD_CATEGORY_LABEL[field.category]} />
                {linkedHome && <Chip size="small" variant="outlined" label="Our field" sx={{ color: 'primary.dark', fontWeight: 600 }} />}
              </Stack>
            </Stack>
          </Stack>

          {/* Side by side on the right on a desktop; two full-width halves under the header on a phone. */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: field.mapUrl ? '1fr 1fr' : '1fr', md: 'auto auto' },
              gap: 1,
              width: { xs: '100%', md: 'auto' },
              '& .MuiButton-root': { minHeight: { xs: 44, md: 40 } },
            }}
          >
            {field.mapUrl && (
              <MuiButton
                component="a"
                href={field.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                startIcon={<MapOutlinedIcon fontSize="small" />}
              >
                Open in maps
              </MuiButton>
            )}
            {/* The primary page action: the same filled dark green as Add field. Disabled, never hidden, when this club
                cannot edit the field - the reason is its tooltip. */}
            <Box component="span" title={edit.reason ?? undefined} sx={{ display: 'inline-flex' }}>
              {edit.editable ? (
                <MuiButton component={RouterLink} to={`/manage/fixtures/fields/${field.id}/edit`} variant="contained" startIcon={<EditOutlinedIcon fontSize="small" />} sx={{ width: '100%' }}>
                  Edit
                </MuiButton>
              ) : (
                <MuiButton variant="contained" disabled startIcon={<EditOutlinedIcon fontSize="small" />} sx={{ width: '100%' }}>
                  Edit
                </MuiButton>
              )}
            </Box>
          </Box>
        </Box>
      </PageHeaderBand>

      <FieldNotice field={field} />

      <FieldKeyFigures field={field} />

      <FieldInfoCards
        field={field}
        detailsAction={
          <MuiButton
            variant="outlined"
            disabled={homeLink.pendingId === field.id}
            startIcon={linkedHome ? <LinkOffIcon fontSize="small" /> : <LinkIcon fontSize="small" />}
            onClick={() => homeLink.toggleHome(field)}
            sx={{ minHeight: { xs: 44, md: 34 } }}
          >
            {linkedHome ? 'Remove from our fields' : 'Add to our fields'}
          </MuiButton>
        }
      />

      {homeLink.dialog}
    </Box>
  )
}
