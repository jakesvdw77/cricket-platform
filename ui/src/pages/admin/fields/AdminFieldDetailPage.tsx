import { useState } from 'react'
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, Link as MuiLink, Stack, Typography } from '@mui/material'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import { EmptyState } from '../../../components/EmptyState'
import { InfoCard } from '../../../components/InfoCard'
import { getPlatformPlayingArea, PLATFORM_FIELDS_KEY } from '../../../api/platformPlayingAreaApi'
import { useFieldStatusActions } from '../../../hooks/useFieldStatusActions'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { ADMIN_FIELDS_PATH, fieldMenuItems } from '../../manage/fields/fieldMenuItems'
import { FieldInfoCards } from '../../manage/fields/FieldInfoCards'
import { FieldKeyFigures } from '../../manage/fields/FieldKeyFigures'
import { FieldNotice } from '../../manage/fields/FieldNotice'
import { FieldPageHeader } from '../../manage/fields/FieldPageHeader'
import { useFieldDirections } from '../../manage/fields/useFieldDirections'
import { FieldMergeDialog } from './FieldMergeDialog'

// docs/specs/099-fields-directory.md (9) and docs/specs/134: the platform admin's field page - the managers' page shape with the
// admin's actions all in ONE Manage Field menu: Edit Field, Verify, Reject or Reopen (disabled with its reason for a verified
// field), Merge Into... and Open In Maps. The Details card lists every club using the field and a card lists possible duplicates,
// so a duplicate can be opened and merged.
export default function AdminFieldDetailPage() {
  const { fieldId } = useParams<{ fieldId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const statusActions = useFieldStatusActions()
  const [mergeOpen, setMergeOpen] = useState(false)

  const { data: field, isPending, isError } = useQuery({
    queryKey: [...PLATFORM_FIELDS_KEY, 'detail', fieldId],
    queryFn: () => getPlatformPlayingArea(fieldId as string),
    enabled: Boolean(fieldId),
  })

  const directions = useFieldDirections(field)

  if (isPending) {
    return null
  }

  if (isError || !field) {
    return <EmptyState title="Couldn't load this field" description="Something went wrong loading this field. Please try again." />
  }

  const duplicates = field.possibleDuplicates ?? []
  // docs/specs/127: the origin of every leaving link is this page, labelled with the field's name.
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), field.name.slice(0, 60))
  const menuItems = fieldMenuItems({
    field,
    admin: true,
    placement: 'page',
    leaveTo,
    onStatusAction: statusActions.requestAction,
    onMerge: () => setMergeOpen(true),
    directions: directions.items,
  })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <FieldPageHeader field={field} listPath={ADMIN_FIELDS_PATH} menuItems={menuItems} />

      <FieldNotice field={field} platform />

      <FieldKeyFigures field={field} platform />

      <FieldInfoCards
        field={field}
        extraDetails={[{ label: 'Clubs', value: (field.linkedClubs ?? []).map((club) => club.clubName).join(', ') }]}
        extraCards={
          <InfoCard flat title="Possible duplicates" icon={<FlagOutlinedIcon />}>
            {duplicates.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No similar fields found.
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                {duplicates.map((duplicate) => (
                  <MuiLink key={duplicate.id} component={RouterLink} to={leaveTo(`${ADMIN_FIELDS_PATH}/${duplicate.id}`)} underline="hover" sx={{ fontWeight: 600 }}>
                    {duplicate.name}
                  </MuiLink>
                ))}
              </Stack>
            )}
          </InfoCard>
        }
      />

      {statusActions.dialog}
      {directions.sheet}

      <FieldMergeDialog
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        source={field}
        onMerged={(target) => {
          setMergeOpen(false)
          navigate(`${ADMIN_FIELDS_PATH}/${target.id}`)
        }}
      />
    </Box>
  )
}
