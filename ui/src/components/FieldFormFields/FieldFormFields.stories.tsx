import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FieldFormFields } from './FieldFormFields'
import type { FieldFormFieldsProps } from './FieldFormFields'
import { emptyFieldForm } from '../../utils/fieldForm'
import type { FieldFormValues } from '../../utils/fieldForm'

// The "Did you mean" lookup is backed by React Query, so every story sits in a QueryClientProvider (as ClubPicker's).
function Demo(props: Partial<FieldFormFieldsProps> & { initial?: Partial<FieldFormValues> }) {
  const { initial, ...rest } = props
  const [values, setValues] = useState<FieldFormValues>({ ...emptyFieldForm('ZA'), ...initial })
  return <FieldFormFields values={values} onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))} {...rest} />
}

const meta: Meta<typeof FieldFormFields> = {
  title: 'Components/FieldFormFields',
  component: FieldFormFields,
  parameters: { layout: 'padded' },
  decorators: [
    (StoryComponent) => {
      const queryClient = new QueryClient()
      return (
        <QueryClientProvider client={queryClient}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2, maxWidth: 960 }}>
            <StoryComponent />
          </Box>
        </QueryClientProvider>
      )
    },
  ],
}
export default meta

type Story = StoryObj<typeof FieldFormFields>

// docs/specs/099: one body for the full page and the match form's add-field dialog.
export const Page: Story = { render: () => <Demo variant="page" /> }
export const Dialog: Story = { render: () => <Demo variant="dialog" /> }
export const WithErrors: Story = {
  render: () => <Demo variant="page" errors={{ name: 'Name is required', city: 'City is required', country: 'Country is required' }} />,
}
export const ReadOnly: Story = { render: () => <Demo variant="page" disabled initial={{ name: 'Riverside Oval', ownerName: 'Riverside CC' }} /> }
export const MobileViewport: Story = { render: () => <Demo variant="dialog" />, parameters: { viewport: { defaultViewport: 'mobile' } } }

// docs/specs/133: the Location section (coordinates, Read From Map Link, Find On Map) and the Entrance Or Parking section.
export const CompactWithLocation: Story = {
  render: () => (
    <Demo
      variant="page"
      compact
      initial={{ name: 'Riverside Oval', ownerName: 'Riverside CC', mapUrl: 'https://www.google.com/maps/@-26.1325,28.0567,17z', latitude: '-26.1325', longitude: '28.0567', accessLatitude: '-26.1331', accessLongitude: '28.0571', accessNote: 'Use gate 2 off Main Rd' }}
    />
  ),
}
export const LocationErrors: Story = {
  render: () => <Demo variant="page" compact errors={{ latitude: 'Enter the latitude too, or clear the longitude', accessLongitude: 'Longitude must be between -180 and 180' }} initial={{ longitude: '28.05', accessLatitude: '-26.1', accessLongitude: '190' }} />,
}
export const LocationMobile: Story = { render: () => <Demo variant="page" compact />, parameters: { viewport: { defaultViewport: 'mobile' } } }
