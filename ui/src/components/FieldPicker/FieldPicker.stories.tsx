import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FieldPicker } from './FieldPicker'
import type { FieldPickerValue } from './FieldPicker'

function Demo({ initial = null }: { initial?: FieldPickerValue | null }) {
  const [value, setValue] = useState<FieldPickerValue | null>(initial)
  return <FieldPicker clubId="club-1" value={value} onChange={setValue} />
}

const meta: Meta<typeof FieldPicker> = {
  title: 'Components/FieldPicker',
  component: FieldPicker,
  parameters: { layout: 'padded' },
  // FieldPicker is backed by React Query (it searches the fields directory on first focus), so it sits in a
  // QueryClientProvider, as ClubPicker's story does, inside the field grid RecordFormScreen provides in the app.
  decorators: [
    (StoryComponent) => {
      const queryClient = new QueryClient()
      return (
        <QueryClientProvider client={queryClient}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <StoryComponent />
          </Box>
        </QueryClientProvider>
      )
    },
  ],
}
export default meta

type Story = StoryObj<typeof FieldPicker>

export const Empty: Story = { render: () => <Demo /> }
export const WithVerifiedField: Story = { render: () => <Demo initial={{ id: 'f1', name: 'Riverside Oval', verificationStatus: 'VERIFIED' }} /> }
export const WithUnverifiedField: Story = { render: () => <Demo initial={{ id: 'f2', name: 'Away Park', verificationStatus: 'UNVERIFIED' }} /> }
export const MobileViewport: Story = { render: () => <Demo />, parameters: { viewport: { defaultViewport: 'mobile' } } }
