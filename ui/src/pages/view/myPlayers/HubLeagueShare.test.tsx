import { ThemeProvider } from '@mui/material/styles'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseTheme } from '../../../theme'
import { HubLeagueShare } from './HubLeagueShare'
import { leagueDto } from '../../../test/hubLeagueFixtures'

const mocks = vi.hoisted(() => ({ poster: vi.fn(), download: vi.fn() }))
vi.mock('../../../utils/leagueSchedulePoster', () => ({ generateLeagueSharePoster: (...args: unknown[]) => mocks.poster(...args) }))
vi.mock('../../../utils/share/downloadFile', () => ({ downloadFile: (file: File) => mocks.download(file) }))

// docs/specs/123 (Share): one tap makes the standard Schedule poster. Download is always there, Share only where the browser can
// share files, and nothing at all when the club has switched the Poster format off.
const nav = navigator as unknown as Record<string, unknown>
const setNative = (on: boolean) => {
  nav.share = on ? vi.fn().mockResolvedValue(undefined) : undefined
  nav.canShare = on ? vi.fn().mockReturnValue(true) : undefined
}

const show = (dto = leagueDto()) =>
  render(
    <ThemeProvider theme={baseTheme}>
      <HubLeagueShare dto={dto} clubName="Paarl CC" />
    </ThemeProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  mocks.poster.mockResolvedValue('blob:poster')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: async () => new Blob(['png'], { type: 'image/png' }) }))
  URL.revokeObjectURL = vi.fn()
  setNative(false)
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete nav.share
  delete nav.canShare
})

describe('HubLeagueShare', () => {
  it('shows only Download when the browser cannot share files', () => {
    show()

    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
  })

  it('shows Share and Download when the browser can share files', () => {
    setNative(true)
    show()

    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
  })

  it('renders nothing when the Poster format is disabled, even with native sharing', () => {
    setNative(true)
    const { container } = show(leagueDto({ shareDisabledFormats: ['POSTER'] }))

    expect(container).toBeEmptyDOMElement()
  })

  it('still shows the buttons when only another format is disabled', () => {
    show(leagueDto({ shareDisabledFormats: ['ICS'] }))
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
  })

  it('Download makes the Schedule poster with team logos and no footer, then downloads a named PNG', async () => {
    show()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1))
    const [model, , options] = mocks.poster.mock.calls[0]
    expect(model.contents).toEqual(['SCHEDULE'])
    expect(options).toEqual({ teamLogos: true, footer: false })
    const file = mocks.download.mock.calls[0][0] as File
    expect(file.name).toBe('Boland Under 15 2026/27.png'.replace(/[\\/:*?"<>|]/g, ''))
    expect(file.type).toBe('image/png')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:poster')
  })

  it('Share hands the file to the share sheet and does not download', async () => {
    setNative(true)
    show()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Share' }))

    await waitFor(() => expect(nav.share).toHaveBeenCalledTimes(1))
    const arg = (nav.share as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.files).toHaveLength(1)
    expect(arg.title).toBe('Boland Under 15 2026/27')
    expect(mocks.download).not.toHaveBeenCalled()
  })

  it('treats cancelling the share sheet as no error', async () => {
    setNative(true)
    ;(nav.share as ReturnType<typeof vi.fn>).mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    show()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Share' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled())
    expect(screen.queryByText('The poster could not be shared. Please try again.')).not.toBeInTheDocument()
  })

  it('disables both buttons and says Preparing while the poster is made', async () => {
    setNative(true)
    let finish: (url: string) => void = () => undefined
    mocks.poster.mockReturnValue(new Promise<string>((resolve) => { finish = resolve }))
    show()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByRole('button', { name: 'Preparing…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
    finish('blob:poster')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled())
  })

  it('shows an error line when the poster fails, and clears it on the next try', async () => {
    const user = userEvent.setup()
    mocks.poster.mockRejectedValueOnce(new Error('canvas'))
    show()

    await user.click(screen.getByRole('button', { name: 'Download' }))
    expect(await screen.findByText('The poster could not be shared. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Download' }))
    await waitFor(() => expect(mocks.download).toHaveBeenCalled())
    expect(screen.queryByText('The poster could not be shared. Please try again.')).not.toBeInTheDocument()
  })
})
