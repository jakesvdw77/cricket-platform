import type { FormEvent } from 'react'
import { Box, Button as MuiButton, Stack, Typography } from '@mui/material'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, compactButtonSx } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { FieldFormFields } from '../../../components/FieldFormFields'
import { RecordFormScreen } from '../../../components/RecordFormScreen'
import { getPlatformPlayingArea, PLATFORM_FIELDS_KEY, updatePlatformPlayingArea } from '../../../api/platformPlayingAreaApi'
import type { PlatformPlayingArea } from '../../../api/platformPlayingAreaApi'
import type { PlayingAreaPayload } from '../../../api/playingAreaApi'
import { useFieldForm } from '../../../hooks/useFieldForm'
import { useAfterSave, useBackLink } from '../../../hooks/useReturnTo'
import { errorDetail } from '../../../utils/errorDetail'

const FORM_ID = 'admin-field-form'

function AdminFieldFormScreen({ field }: { field: PlatformPlayingArea }) {
  const queryClient = useQueryClient()
  const form = useFieldForm(field, undefined)
  const backTo = `/admin/fields/${field.id}`
  // docs/specs/127 and 134: Back, Cancel and Save go to the origin when there is one, else to the field's page.
  const afterSave = useAfterSave(backTo)
  const cancelLink = useBackLink(backTo, 'Cancel')

  const save = useMutation({
    mutationFn: (payload: PlayingAreaPayload) => updatePlatformPlayingArea(field.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_FIELDS_KEY })
      afterSave()
    },
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = form.submit()
    if (payload) save.mutate(payload)
  }

  return (
    <RecordFormScreen
      title="Edit Field"
      backTo={backTo}
      backLabel="Back to Field"
      compact
      actions={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {save.isError && (
            <Typography variant="body2" color="error.main">
              {errorDetail(save.error, 'Something went wrong saving this field. Please try again.')}
            </Typography>
          )}
          <MuiButton component={RouterLink} to={cancelLink.to ?? backTo} variant="outlined" size="small" sx={compactButtonSx}>
            Cancel
          </MuiButton>
          <Button size="compact" type="submit" form={FORM_ID} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </Stack>
      }
    >
      <Box component="form" id={FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'contents' }}>
        <FieldFormFields values={form.values} onChange={form.update} errors={form.errors} compact />
      </Box>
    </RecordFormScreen>
  )
}

// docs/specs/099-fields-directory.md (9) and docs/specs/134: the platform admin edits any field in any state (a verified field stays verified).
// The same form body as the managers', without the "Did you mean" lookup (no club).
export default function AdminFieldFormPage() {
  const { fieldId } = useParams<{ fieldId?: string }>()
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

  return <AdminFieldFormScreen key={field.id} field={field} />
}
