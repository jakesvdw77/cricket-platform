import { Box, CircularProgress } from '@mui/material'
import { useOutletContext, useParams } from 'react-router-dom'
import { useImportBatch, useImportTypes } from '../../../api/importApi'
import { Button } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { ImportWizard } from '../../../components/ImportWizard'
import type { ImportBatch } from '../../../api/importApi'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { IMPORT_CONSUMERS } from './importConsumers'
import type { ImportConsumer } from './importConsumers'

const MANAGE_PATH = '/manage'

// docs/specs/097-import-framework.md, "Generic frontend": the resume route /manage/imports/:batchId. It opens any batch in the
// right step (a PREVIEW at Check rows with the server's state, a COMMITTED or DELETED one at the report). It knows nothing of a
// consumer: columns default to the row values, and the scope label is the file and the import type. A consumer's own page
// (spec 098) gives the richer screen; this is the generic way back in, from the import history.
export default function ImportResumePage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { batchId } = useParams<{ batchId: string }>()
  useDocumentTitle('Import')
  const batchQuery = useImportBatch(clubId ?? '', batchId ?? null)
  const typesQuery = useImportTypes(clubId ?? '')

  if (!clubId) return <EmptyState title="Not authorised" description="No club is associated with your account." />
  if (batchQuery.isPending || typesQuery.isPending) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} aria-label="Loading the import" /></Box>
  }
  if (batchQuery.isError || !batchQuery.data) {
    return <EmptyState title="We could not open this import" description="It may have been removed, or it belongs to another club." action={<Button size="compact" onClick={() => void batchQuery.refetch()}>Try again</Button>} />
  }

  const batch = batchQuery.data
  const label = typesQuery.data?.find((type) => type.type === batch.type)?.label ?? 'Import'
  const params = (batch.scope?.params ?? {}) as Record<string, string>
  const consumer = IMPORT_CONSUMERS[batch.type]
  return consumer ? (
    <ConsumerResume clubId={clubId} batch={batch} params={params} useWizardProps={consumer.useWizardProps} />
  ) : (
    <ImportWizard
      key={batch.id}
      clubId={clubId}
      type={batch.type}
      scope={scopeOf(batch, params)}
      title={`Import: ${label}`}
      scopeLabel={batch.fileName ? `${label}, file ${batch.fileName}` : label}
      backTo={MANAGE_PATH}
      backLabel="Back to the club"
      batchId={batch.id}
    />
  )
}

function scopeOf(batch: ImportBatch, params: Record<string, string>) {
  return { params, scopeMode: batch.scopeMode, templateScope: (batch.scope?.templateScope as 'OURS_ONLY' | 'OURS_AND_OTHERS' | undefined) ?? null }
}

// A batch of a registered type: the consumer's configuration (columns, wording, result links, keys to refresh) wraps the wizard.
function ConsumerResume({ clubId, batch, params, useWizardProps }: { clubId: string; batch: ImportBatch; params: Record<string, string>; useWizardProps: ImportConsumer['useWizardProps'] }) {
  const consumerProps = useWizardProps(clubId, params)
  if (!consumerProps) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} aria-label="Loading the import" /></Box>
  return <ImportWizard key={batch.id} clubId={clubId} type={batch.type} scope={scopeOf(batch, params)} batchId={batch.id} {...consumerProps} />
}
