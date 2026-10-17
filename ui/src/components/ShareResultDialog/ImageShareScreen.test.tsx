import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageShareScreen } from './ImageShareScreen'
import { makeScreenProps, mockCanvas, renderScreen, setInitials, updateChoices } from './shareScreenTestUtils'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanvas()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
})

describe('ImageShareScreen', () => {
  it('shows the result card preview with its label and the template, size and include controls', async () => {
    renderScreen(<ImageShareScreen {...makeScreenProps()} />)

    expect(screen.getByRole('img', { name: 'Result card: Riverside 1 won by 24 runs' })).toBeInTheDocument()
    for (const name of ['Club green', 'Night', 'Daylight', 'Square 1080', 'Portrait 4:5', 'Story 9:16']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    for (const name of [
      'First names as initials',
      'Top performers',
      'Player of the match',
      'Venue and date line',
      'Club logo',
      'Team logos',
      'Footer line',
    ]) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument()
    }
    // The card always shows both scores, so there is no Teams control.
    expect(screen.queryByText('Teams')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Our team only' })).not.toBeInTheDocument()
  })

  it('hides the League logo switch when the league has no logo and shows it when it has one', () => {
    const { unmount } = renderScreen(<ImageShareScreen {...makeScreenProps()} />)
    expect(screen.queryByRole('checkbox', { name: 'League logo' })).not.toBeInTheDocument()
    unmount()

    renderScreen(<ImageShareScreen {...makeScreenProps({ leagueLogoUrl: 'https://example.com/league.png' })} />)
    expect(screen.getByRole('checkbox', { name: 'League logo' })).toBeInTheDocument()
  })

  it('remembers a changed template, size, switch and footer line through updateChoices', async () => {
    renderScreen(<ImageShareScreen {...makeScreenProps()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Night' }))
    expect(updateChoices).toHaveBeenLastCalledWith({ templates: expect.objectContaining({ image: 'NIGHT' }) })
    await userEvent.click(screen.getByRole('button', { name: 'Story 9:16' }))
    expect(updateChoices).toHaveBeenLastCalledWith({ imageSize: 'STORY' })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Top performers' }))
    expect(updateChoices).toHaveBeenLastCalledWith({
      include: expect.objectContaining({ image: expect.objectContaining({ topPerformers: false }) }),
    })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Footer line' }))
    expect(updateChoices).toHaveBeenLastCalledWith({ footerLine: false })
    await userEvent.click(screen.getByRole('checkbox', { name: 'First names as initials' }))
    expect(setInitials).toHaveBeenCalledWith(true)
  })

  it('offers Download PNG where the browser cannot share files', async () => {
    renderScreen(<ImageShareScreen {...makeScreenProps()} />)

    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled())
  })

  it('offers Share, handing over the PNG named after the teams, where the browser can share files, and a cancel is silent', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    renderScreen(<ImageShareScreen {...makeScreenProps()} />)

    const button = await screen.findByRole('button', { name: 'Share' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)

    const arg = share.mock.calls[0][0] as { files: File[]; title: string }
    expect(arg.files[0].name).toBe('Riverside 1 v Pretoria CC 2026-10-17.png')
    expect(arg.title).toBe('Riverside 1 v Pretoria CC')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('offers Copy image only where ClipboardItem is supported', async () => {
    const { unmount } = renderScreen(<ImageShareScreen {...makeScreenProps()} />)
    expect(screen.queryByRole('button', { name: 'Copy image' })).not.toBeInTheDocument()
    unmount()

    vi.stubGlobal('ClipboardItem', class {})
    Object.defineProperty(navigator, 'clipboard', { value: { write: vi.fn() }, configurable: true })
    renderScreen(<ImageShareScreen {...makeScreenProps()} />)
    expect(screen.getByRole('button', { name: 'Copy image' })).toBeInTheDocument()
  })

  it('shows an inline error and keeps the screen when the image cannot be made', async () => {
    vi.restoreAllMocks()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    renderScreen(<ImageShareScreen {...makeScreenProps()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('The image could not be created')
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled()
  })
})
