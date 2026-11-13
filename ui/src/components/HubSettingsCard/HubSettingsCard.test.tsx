import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { HubSettingsCard } from './HubSettingsCard'
import { makeHubSettings } from '../../test/clubInfoFixtures'

// docs/specs/148 (Manager side): toggle chips, the phone and email chips depend on the directory, each tap reports the whole set.
const chip = (name: string) => screen.getByRole('button', { name })
const LABELS = ['Show Club Details', 'Show Club Phone And Email', 'Show Website And Social Links', 'Show Logos', 'Allow Logo Download', 'Show Contact Directory', 'Show Phone Numbers', 'Show Email Addresses']

describe('HubSettingsCard', () => {
  it('shows eight chips whose pressed state follows the switches', () => {
    render(<HubSettingsCard settings={makeHubSettings({ logoDownloadAllowed: false, directoryEmailShown: false })} onChange={vi.fn()} />)

    expect(LABELS.map((label) => chip(label).getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true', 'true', 'false', 'true', 'true', 'false'])
  })

  it('reports the whole new set when a chip is tapped', async () => {
    const onChange = vi.fn()
    const settings = makeHubSettings()
    render(<HubSettingsCard settings={settings} onChange={onChange} />)

    await userEvent.click(chip('Allow Logo Download'))
    expect(onChange).toHaveBeenCalledWith({ ...settings, logoDownloadAllowed: true })
    await userEvent.click(chip('Show Logos'))
    expect(onChange).toHaveBeenLastCalledWith({ ...settings, logosShown: false })
  })

  it('turns the phone and email chips off with the directory, in one payload', async () => {
    const onChange = vi.fn()
    render(<HubSettingsCard settings={makeHubSettings({ directoryPhoneShown: true, directoryEmailShown: true })} onChange={onChange} />)

    await userEvent.click(chip('Show Contact Directory'))
    expect(onChange).toHaveBeenCalledWith(makeHubSettings({ directoryShown: false, directoryPhoneShown: false, directoryEmailShown: false }))
  })

  it('disables the phone and email chips with the reason while the directory is off', () => {
    render(<HubSettingsCard settings={makeHubSettings({ directoryShown: false, directoryPhoneShown: false })} onChange={vi.fn()} />)

    expect(chip('Show Phone Numbers')).toBeDisabled()
    expect(chip('Show Email Addresses')).toBeDisabled()
    expect(chip('Show Contact Directory')).toBeEnabled()
    expect(screen.getByText('Turn on the contact directory first.')).toBeInTheDocument()
  })

  it('enables them, with no reason shown, while the directory is on', () => {
    render(<HubSettingsCard settings={makeHubSettings()} onChange={vi.fn()} />)

    expect(chip('Show Phone Numbers')).toBeEnabled()
    expect(chip('Show Email Addresses')).toBeEnabled()
    expect(screen.queryByText('Turn on the contact directory first.')).not.toBeInTheDocument()
  })

  it('disables every chip while the switches load or a save is running, and does nothing when tapped', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<HubSettingsCard settings={undefined} onChange={onChange} />)
    for (const label of LABELS) expect(chip(label)).toBeDisabled()

    rerender(<HubSettingsCard settings={makeHubSettings()} onChange={onChange} disabled />)
    for (const label of LABELS) expect(chip(label)).toBeDisabled()
    fireEvent.click(chip('Show Logos'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the server message for a failed save, and the fallback otherwise', () => {
    const failed = new AxiosError('bad', '400', undefined, undefined, { status: 400, data: { detail: 'Not allowed.' } } as never)
    const { rerender } = render(<HubSettingsCard settings={makeHubSettings()} onChange={vi.fn()} error={failed} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Not allowed.')

    rerender(<HubSettingsCard settings={makeHubSettings()} onChange={vi.fn()} error={new Error('boom')} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/Player Hub settings|boom/)

    rerender(<HubSettingsCard settings={makeHubSettings()} onChange={vi.fn()} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
