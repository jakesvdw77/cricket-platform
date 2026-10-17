import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageShareScreen } from './ImageShareScreen'
import { PdfShareScreen } from './PdfShareScreen'
import { TvShareScreen } from './TvShareScreen'
import { makeScreenProps, mockCanvas, renderScreen } from './shareScreenTestUtils'

// docs/specs/114-share-result.md (Preview and delivery, Test Plan): the main button is Share or Download by capability, and
// Download is ALWAYS present, for the PDF, Image and TV screens, with navigator.canShare mocked both ways.
vi.mock('jspdf', () => {
  class MockJsPDF {
    setFillColor = vi.fn()
    setDrawColor = vi.fn()
    setLineWidth = vi.fn()
    setTextColor = vi.fn()
    setFont = vi.fn()
    setFontSize = vi.fn()
    setProperties = vi.fn()
    rect = vi.fn()
    roundedRect = vi.fn()
    line = vi.fn()
    text = vi.fn()
    addImage = vi.fn()
    addPage = vi.fn()
    getTextWidth = (value: string) => value.length * 1.6
    output = vi.fn(() => new Blob(['fake-pdf']))
  }
  return { jsPDF: MockJsPDF }
})

const SCREENS = [
  { name: 'PDF', Screen: PdfShareScreen, download: 'Download PDF', extension: 'pdf' },
  { name: 'Image', Screen: ImageShareScreen, download: 'Download PNG', extension: 'png' },
  { name: 'TV', Screen: TvShareScreen, download: 'Download PNG', extension: 'png' },
]

beforeEach(() => {
  vi.clearAllMocks()
  const context = mockCanvas()
  Object.assign(context, { stroke: vi.fn(), lineTo: vi.fn() })
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:file'), revokeObjectURL: vi.fn() }))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
})

for (const { name, Screen, download, extension } of SCREENS) {
  describe(`${name} screen delivery`, () => {
    it('reads Download only, and primary, where files cannot be shared', async () => {
      Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true })
      renderScreen(<Screen {...makeScreenProps()} />)

      const button = await screen.findByRole('button', { name: download })
      await waitFor(() => expect(button).toBeEnabled())
      expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    })

    it('reads Share where files can be shared, and still offers Download', async () => {
      Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
      renderScreen(<Screen {...makeScreenProps()} />)

      const share = await screen.findByRole('button', { name: 'Share' })
      await waitFor(() => expect(share).toBeEnabled())
      expect(screen.getByRole('button', { name: download })).toBeEnabled()
    })

    it('falls back to Download when canShare throws', async () => {
      Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
      Object.defineProperty(navigator, 'canShare', {
        value: () => {
          throw new TypeError('bad file type')
        },
        configurable: true,
      })
      renderScreen(<Screen {...makeScreenProps()} />)

      await waitFor(() => expect(screen.getByRole('button', { name: download })).toBeEnabled())
      expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    })

    it('falls back to Download without a secure context, even if the browser has share', async () => {
      Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
      vi.stubGlobal('isSecureContext', false)
      renderScreen(<Screen {...makeScreenProps()} />)

      await waitFor(() => expect(screen.getByRole('button', { name: download })).toBeEnabled())
      expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    })

    it('Download saves the file named after the teams and the date', async () => {
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      renderScreen(<Screen {...makeScreenProps()} />)

      const button = await screen.findByRole('button', { name: download })
      await waitFor(() => expect(button).toBeEnabled())
      let saved = ''
      click.mockImplementation(function (this: HTMLAnchorElement) {
        saved = this.download
      })
      await userEvent.click(button)

      expect(click).toHaveBeenCalled()
      expect(saved).toBe(`Riverside 1 v Pretoria CC 2026-10-17.${extension}`)
    })

    it('shows an inline error, keeps the screen and keeps Download, when the share sheet fails for a real reason', async () => {
      Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new Error('no apps')), configurable: true })
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
      renderScreen(<Screen {...makeScreenProps()} />)

      const share = await screen.findByRole('button', { name: 'Share' })
      await waitFor(() => expect(share).toBeEnabled())
      await userEvent.click(share)

      expect(await screen.findByText(/Could not open the share sheet/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: download })).toBeEnabled()
    })
  })
}
