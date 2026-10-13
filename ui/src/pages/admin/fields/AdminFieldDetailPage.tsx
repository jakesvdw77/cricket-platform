import { useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Box, Button as MuiButton, Chip, Link as MuiLink, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CallMergeIcon from '@mui/icons-material/CallMerge'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import { EmptyState } from '../../../components/EmptyState'
import { FieldStatusMenu } from '../../../components/FieldStatusMenu'
import { InfoCard } from '../../../components/InfoCard'
import { PageHeaderBand } from '../../../components/PageHeaderBand'
import { avatarSx, badgeSx } from '../../../components/RecordCard'
import { getPlatformPlayingArea, PLATFORM_FIELDS_KEY } from '../../../api/platformPlayingAreaApi'
import { useFieldStatusActions } from '../../../hooks/useFieldStatusActions'
import { FIELD_CATEGORY_LABEL } from '../../../utils/fieldLabels'
import { FIELD_STATUS_ACTIONS, fieldStatusBadge, fieldStatusOf, VERIFIED_FIELD_NO_ACTIONS } from '../../../utils/fieldStatus'
import { initialsFromName } from '../../../utils/initials'
import { FieldInfoCards } from '../../manage/fields/FieldInfoCards'
import { FieldKeyFigures } from '../../manage/fields/FieldKeyFigures'
import { FieldNotice } from '../../manage/fields/FieldNotice'
import { FieldMergeDialog } from './FieldMergeDialog'

// docs/specs/099-fields-directory.md (9): the platform admin's field page - the managers' page shape with the admin's actions:
// Status (one button and menu, disabled with a tooltip for a verified field), Merge into... and the filled Edit. The Details
// card lists every club using the field and a card lists possible duplicates, so a duplicate can be opened and merged.
export default function AdminFieldDetailPage() {
  const { fieldId } = useParams<{ fieldId?: string }>()
  const navigate = useNavigate()
  const statusActions = useFieldStatusActions()
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null)
  const [mergeOpen, setMergeOpen] = useState(false)

  const { data: field, isPending, isError } = useQuery({
    queryKey: [...PLATFORM_FIELDS_KEY, 'detail', fieldId],
    queryFn: () => getPlatformPlayingArea(fieldId as string),
    enabled: Boolean(fieldId),
  })

  if (isPending) {
    return null
  }

  if (isError || !field) {
    return <EmptyState title="Couldn't load this field" description="Something went wrong loading this field. Please try again." />
  }

  const status = fieldStatusOf(field)
  const badge = fieldStatusBadge(status)
  const noStatusChanges = FIELD_STATUS_ACTIONS[status].length === 0
  const duplicates = field.possibleDuplicates ?? []

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeaderBand>
        <MuiButton
          component={RouterLink}
          to="/admin/fields"
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
              </Stack>
            </Stack>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, auto)' },
              gap: 1,
              width: { xs: '100%', md: 'auto' },
              '& .MuiButton-root': { minHeight: { xs: 44, md: 40 } },
            }}
          >
            {field.mapUrl && (
              <MuiButton component="a" href={field.mapUrl} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<MapOutlinedIcon fontSize="small" />}>
                Open in maps
              </MuiButton>
            )}
            <Box component="span" title={noStatusChanges ? VERIFIED_FIELD_NO_ACTIONS : undefined} sx={{ display: 'inline-flex' }}>
              <MuiButton
                variant="outlined"
                aria-haspopup="menu"
                disabled={noStatusChanges}
                startIcon={<ManageAccountsOutlinedIcon fontSize="small" />}
                onClick={(event) => setStatusAnchor(event.currentTarget)}
                sx={{ width: '100%' }}
              >
                Status
              </MuiButton>
            </Box>
            <MuiButton variant="outlined" startIcon={<CallMergeIcon fontSize="small" />} onClick={() => setMergeOpen(true)}>
              Merge into...
            </MuiButton>
            <MuiButton component={RouterLink} to={`/admin/fields/${field.id}/edit`} variant="contained" startIcon={<EditOutlinedIcon fontSize="small" />}>
              Edit
            </MuiButton>
          </Box>
        </Box>
      </PageHeaderBand>

      <FieldNotice
        field={field}
        platform
        action={
          status === 'unverified' ? (
            <MuiButton variant="contained" onClick={() => statusActions.requestAction(field, 'verify')} disabled={statusActions.pending}>
              Verify
            </MuiButton>
          ) : undefined
        }
      />

      <FieldKeyFigures field={field} platform />

      <FieldInfoCards
        field={field}
        extraDetails={[{ label: 'Clubs', value: (field.linkedClubs ?? []).map((club) => club.name).join(', ') }]}
        extraCards={
          <InfoCard title="Possible duplicates" icon={<FlagOutlinedIcon />}>
            {duplicates.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No similar fields found.
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                {duplicates.map((duplicate) => (
                  <MuiLink key={duplicate.id} component={RouterLink} to={`/admin/fields/${duplicate.id}`} underline="hover" sx={{ fontWeight: 600 }}>
                    {duplicate.name}
                  </MuiLink>
                ))}
              </Stack>
            )}
          </InfoCard>
        }
      />

      <FieldStatusMenu
        status={status}
        anchorEl={statusAnchor}
        onClose={() => setStatusAnchor(null)}
        onAction={(action) => statusActions.requestAction(field, action)}
      />
      {statusActions.dialog}

      <FieldMergeDialog
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        source={field}
        onMerged={(target) => {
          setMergeOpen(false)
          navigate(`/admin/fields/${target.id}`)
        }}
      />
    </Box>
  )
}
