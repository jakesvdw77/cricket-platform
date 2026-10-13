import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Box, Button as MuiButton, Stack, Typography } from '@mui/material'
import { Link as RouterLink, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { CompactSwitch } from '../../../components/CompactSwitch'
import { EmptyState } from '../../../components/EmptyState'
import { FieldFormFields } from '../../../components/FieldFormFields'
import { RecordFormScreen } from '../../../components/RecordFormScreen'
import { createPlayingArea, getPlayingArea, playingAreasKey, updatePlayingArea } from '../../../api/playingAreaApi'
import type { PlayingArea, PlayingAreaPayload } from '../../../api/playingAreaApi'
import { useFieldForm } from '../../../hooks/useFieldForm'
import { duplicateFieldId } from '../../../utils/fieldForm'
import { errorDetail } from '../../../utils/errorDetail'
import { fieldEditState } from '../../../utils/fieldStatus'

export const FIELD_FORM_ID = 'field-form'

const LIST_PATH = '/manage/fixtures/fields'

function FieldFormScreen({ clubId, field }: { clubId: string; field: PlayingArea | null }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = field !== null
  const form = useFieldForm(field, clubId)
  const [duplicateOfId, setDuplicateOfId] = useState<string | null>(null)
  // Never automatic: a club records away fields here too, so it says whether this one is its own.
  const [ownField, setOwnField] = useState(false)
  const edit = field ? fieldEditState(field, clubId) : { editable: true, reason: null }
  const backTo = field ? `${LIST_PATH}/${field.id}` : LIST_PATH

  const save = useMutation({
    mutationFn: (payload: PlayingAreaPayload) => (field ? updatePlayingArea(clubId, field.id, payload) : createPlayingArea(clubId, payload, ownField)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: playingAreasKey(clubId) })
      navigate(`${LIST_PATH}/${saved.id}`)
    },
    onError: (error) => setDuplicateOfId(duplicateFieldId(error)),
  })

  // "Use this field" in the Did you mean panel: open the existing field. Linking it to the club is never automatic; the
  // field's own page has the button for that.
  const openExisting = (existing: PlayingArea) => navigate(`${LIST_PATH}/${existing.id}`)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!edit.editable) return
    const payload = form.submit()
    if (payload) save.mutate(payload)
  }

  return (
    <RecordFormScreen
      title={isEdit ? 'Edit field' : 'Add field'}
      backTo={backTo}
      backLabel={isEdit ? 'Back to field' : 'Back to Fields'}
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {save.isError && !duplicateOfId && (
            <Typography variant="body2" color="error.main">
              {errorDetail(save.error, 'Something went wrong saving this field. Please try again.')}
            </Typography>
          )}
          <MuiButton component={RouterLink} to={backTo} variant="outlined">
            Cancel
          </MuiButton>
          {edit.editable && (
            <Button type="submit" form={FIELD_FORM_ID} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add field'}
            </Button>
          )}
        </Stack>
      }
    >
      <Box component="form" id={FIELD_FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'contents' }}>
        {!edit.editable && (
          <Alert severity="info" sx={{ gridColumn: '1 / -1' }}>
            {edit.reason}
          </Alert>
        )}
        <FieldFormFields
          values={form.values}
          onChange={form.update}
          errors={form.errors}
          disabled={!edit.editable}
          clubId={clubId}
          suggest={!isEdit}
          duplicateOfId={duplicateOfId}
          onUseExisting={openExisting}
          countryHint={isEdit ? undefined : 'Chosen from your browser. Change it if it is wrong.'}
        />
        {!isEdit && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <CompactSwitch
              checked={ownField}
              onChange={setOwnField}
              label="This is one of our fields (we play home games here or manage it)"
            />
          </Box>
        )}
      </Box>
    </RecordFormScreen>
  )
}

// docs/specs/099-fields-directory.md (5): Add field and Edit field on the compact form of the Match and Team pages
// (RecordFormScreen with one card of FormSectionHeading sections). A field that cannot be edited opens read-only with the
// reason. Saving goes to the field's page, where an unverified field says so.
export default function FieldFormPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { fieldId } = useParams<{ fieldId?: string }>()
  const isEdit = Boolean(fieldId)

  const fieldQuery = useQuery({
    queryKey: [...playingAreasKey(clubId ?? ''), 'detail', fieldId],
    queryFn: () => getPlayingArea(clubId as string, fieldId as string),
    enabled: Boolean(clubId) && isEdit,
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isEdit && fieldQuery.isPending) {
    return null
  }

  if (isEdit && (fieldQuery.isError || !fieldQuery.data)) {
    return <EmptyState title="Couldn't load this field" description="Something went wrong loading this field. Please try again." />
  }

  return <FieldFormScreen key={fieldId ?? 'new'} clubId={clubId} field={fieldQuery.data ?? null} />
}
