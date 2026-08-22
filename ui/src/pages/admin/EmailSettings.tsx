import { useState } from 'react'
import { Typography } from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { getEmailSettings, sendTestEmail } from '../../api/emailApi'

export default function EmailSettings() {
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['email', 'settings'],
    queryFn: getEmailSettings,
  })

  const testSend = useMutation({
    mutationFn: sendTestEmail,
    onSuccess: (response) => setResult({ success: response.success, message: response.message }),
    onError: () =>
      setResult({ success: false, message: 'Something went wrong sending the test email. Please try again.' }),
  })

  if (isLoading) {
    return null
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Couldn't load email settings"
        description="Something went wrong loading the current email configuration. Please try again."
      />
    )
  }

  return (
    <RecordFormScreen
      title="Email"
      backTo="/admin/configuration"
      backLabel="Back to Configuration"
      actions={
        <>
          <Button
            variant="primary"
            disabled={testSend.isPending}
            onClick={() => {
              setResult(null)
              testSend.mutate()
            }}
          >
            {testSend.isPending ? 'Sending…' : 'Send test email'}
          </Button>
          {result && (
            <Typography
              variant="body2"
              color={result.success ? 'success.main' : 'error.main'}
              sx={{ alignSelf: 'center' }}
            >
              {result.message}
            </Typography>
          )}
        </>
      }
    >
      <Input label="Host" value={data.host} disabled />
      <Input label="Port" value={data.port} disabled />
      <Input label="Authentication" value={data.authEnabled ? 'Enabled' : 'Disabled'} disabled />
      <Input label="STARTTLS" value={data.starttlsEnabled ? 'Enabled' : 'Disabled'} disabled />
      <Input label="From address" value={data.fromAddress} disabled />
      <Input label="From name" value={data.fromName} disabled />
      <Input label="Support address" value={data.supportAddress} disabled />
    </RecordFormScreen>
  )
}
