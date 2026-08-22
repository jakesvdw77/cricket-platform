import api from './axiosConfig'

export interface EmailSettings {
  host: string
  port: number
  authEnabled: boolean
  starttlsEnabled: boolean
  fromAddress: string
  fromName: string
  supportAddress: string
}

export interface EmailTestSendResult {
  success: boolean
  message: string
  sentTo: string
}

export async function getEmailSettings(): Promise<EmailSettings> {
  const { data } = await api.get<EmailSettings>('/platform/email/settings')
  return data
}

export async function sendTestEmail(): Promise<EmailTestSendResult> {
  const { data } = await api.post<EmailTestSendResult>('/platform/email/test-send')
  return data
}
