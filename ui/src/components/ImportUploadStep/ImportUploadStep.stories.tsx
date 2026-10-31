import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ImportScope } from '../../api/importApi'
import { FakeImportApiProvider } from '../ImportWizard/FakeImportApiProvider'
import { SAMPLE_CLUB_ID, SAMPLE_TYPE } from '../ImportWizard/importFixtures'
import { ImportUploadStep } from './ImportUploadStep'
import type { ImportUploadStepProps } from './ImportUploadStep'

const meta: Meta<typeof ImportUploadStep> = {
  title: 'Components/ImportUploadStep',
  component: ImportUploadStep,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ImportUploadStep>

function Harness(props: Partial<ImportUploadStepProps>) {
  const [scope, setScope] = useState<ImportScope>({ params: { leagueId: 'l1' }, scopeMode: 'OURS_ONLY', templateScope: 'OURS_AND_OTHERS' })
  const [file, setFile] = useState<File | null>(null)
  return (
    <FakeImportApiProvider>
      <ImportUploadStep clubId={SAMPLE_CLUB_ID} type={SAMPLE_TYPE} scope={scope} onScopeChange={(patch) => setScope((current) => ({ ...current, ...patch }))} file={file} onFileChange={setFile} {...props} />
    </FakeImportApiProvider>
  )
}

export const Default: Story = { render: () => <Harness /> }
export const FileLevelError: Story = { render: () => <Harness error="This is not the league schedule template. Download the template above and use it." /> }
export const EarlierImport: Story = { render: () => <Harness earlierImportWarning="This file was already imported on 4 October 2026. Importing it again will create nothing that already exists." /> }
export const NoOursScope: Story = { render: () => <Harness type={{ ...SAMPLE_TYPE, supportsOursScope: false }} /> }
export const StartWithNoRows: Story = { render: () => <Harness type={{ ...SAMPLE_TYPE, editable: true }} onStartBlank={() => undefined} startBlankLabel="Start with an empty schedule" /> }
export const Phone: Story = { render: () => <Harness />, parameters: { viewport: { defaultViewport: 'mobile1' } } }
