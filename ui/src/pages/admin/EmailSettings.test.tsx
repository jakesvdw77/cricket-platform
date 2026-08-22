import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmailSettings from './EmailSettings'
import type { EmailSettings as EmailSettingsData, EmailTestSendResult } from '../../api/emailApi'
import { baseTheme } from '../../theme'

const getEmailSettings = vi.fn()
const sendTestEmail = vi.fn()

vi.mock('../../api/emailApi', () => ({
  getEmailSettings: () => getEmailSettings(),
  sendTestEmail: () => sendTestEmail(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function settings(overrides: Partial<EmailSettingsData> = {}): EmailSettingsData {
  return {
    host: 'smtp.gmail.com',
    port: 587,
    authEnabled: true,
    starttlsEnabled: true,
    fromAddress: 'no-reply@cricketlegend.co.za',
    fromName: 'Cricket Legend',
    supportAddress: 'support@cricketlegend.co.za',
    ...overrides,
  }
}

function renderEmailSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/configuration/email']}>
          <EmailSettings />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

describe('EmailSettings', () => {
  it('renders the fetched settings as disabled fields with the correct values', async () => {
    getEmailSettings.mockResolvedValueOnce(settings())

    renderEmailSettings()

    expect(await screen.findByLabelText('Host')).toHaveValue('smtp.gmail.com')
    expect(screen.getByLabelText('Port')).toHaveValue('587')
    expect(screen.getByLabelText('Authentication')).toHaveValue('Enabled')
    expect(screen.getByLabelText('STARTTLS')).toHaveValue('Enabled')
    expect(screen.getByLabelText('From address')).toHaveValue('no-reply@cricketlegend.co.za')
    expect(screen.getByLabelText('From name')).toHaveValue('Cricket Legend')
    expect(screen.getByLabelText('Support address')).toHaveValue('support@cricketlegend.co.za')

    expect(screen.getByLabelText('Host')).toBeDisabled()
    expect(screen.getByLabelText('Port')).toBeDisabled()
  })

  it('shows "Sending…" and disables the button while the test send is pending, then a success message in success.main', async () => {
    const user = userEvent.setup()
    getEmailSettings.mockResolvedValueOnce(settings())
    let resolveSend: (value: EmailTestSendResult) => void = () => {}
    sendTestEmail.mockImplementationOnce(
      () =>
        new Promise<EmailTestSendResult>((resolve) => {
          resolveSend = resolve
        }),
    )

    renderEmailSettings()
    await screen.findByLabelText('Host')

    const button = screen.getByRole('button', { name: 'Send test email' })
    await user.click(button)

    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled()

    resolveSend({ success: true, message: 'Test email sent to jaco@example.com.', sentTo: 'jaco@example.com' })

    const outcome = await screen.findByText('Test email sent to jaco@example.com.')
    expect(outcome).toHaveStyle({ color: 'rgb(14, 124, 102)' }) // theme.ts's success.main (#0e7c66)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send test email' })).not.toBeDisabled())
  })

  it('renders a failure message from a success:false response in error.main', async () => {
    const user = userEvent.setup()
    getEmailSettings.mockResolvedValueOnce(settings())
    sendTestEmail.mockResolvedValueOnce({
      success: false,
      message: 'Failed to send test email: Connection refused',
      sentTo: 'jaco@example.com',
    })

    renderEmailSettings()
    await screen.findByLabelText('Host')

    await user.click(screen.getByRole('button', { name: 'Send test email' }))

    const outcome = await screen.findByText('Failed to send test email: Connection refused')
    expect(outcome).toHaveStyle({ color: 'rgb(176, 64, 46)' }) // theme.ts's error.main (#b0402e)
  })

  it('renders a fallback failure message in error.main when the test-send request itself errors', async () => {
    const user = userEvent.setup()
    getEmailSettings.mockResolvedValueOnce(settings())
    sendTestEmail.mockRejectedValueOnce(new Error('network error'))

    renderEmailSettings()
    await screen.findByLabelText('Host')

    await user.click(screen.getByRole('button', { name: 'Send test email' }))

    const outcome = await screen.findByText(
      'Something went wrong sending the test email. Please try again.',
    )
    expect(outcome).toHaveStyle({ color: 'rgb(176, 64, 46)' }) // theme.ts's error.main (#b0402e)
  })
})
