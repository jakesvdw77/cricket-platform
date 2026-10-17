import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseTheme } from '../../theme'
import { ImageShareScreen } from './ImageShareScreen'
import { PdfShareScreen } from './PdfShareScreen'
import { TvShareScreen } from './TvShareScreen'
import { WhatsAppShareScreen } from './WhatsAppShareScreen'
import { makeScreenProps, mockCanvas, renderScreen } from './shareScreenTestUtils'
import type { ShareScreenProps } from './shareScreenTypes'

// docs/specs/114-share-result.md (Privacy, First names as initials): a file made with the OLD name setting is never handed out
// while the new one is being generated. The moment the model changes, Share, Download, Copy image and Print are off until the
// file for exactly the new input exists.
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
const downloadFile = vi.fn()
vi.mock('../../utils/share/downloadFile', () => ({ downloadFile: (file: File) => downloadFile(file) }))

beforeEach(() => {
  vi.clearAllMocks()
  const context = mockCanvas()
  Object.assign(context, { stroke: vi.fn(), lineTo: vi.fn() })
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:file'), revokeObjectURL: vi.fn() }))
  vi.stubGlobal('ClipboardItem', class {})
  Object.defineProperty(navigator, 'clipboard', { value: { write: vi.fn().mockResolvedValue(undefined) }, configurable: true })
  Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
})

// The same result with another name setting: a NEW model object, as the dialog builds when the switch flips.
function flipped(): ShareScreenProps {
  const base = makeScreenProps()
  const model = { ...base.model, initialsOnly: true }
  return { ...base, model, cardModel: model }
}
const themed = (element: ReactElement) => <ThemeProvider theme={baseTheme}>{element}</ThemeProvider>
const onlyOneCall = () => expect(downloadFile).not.toHaveBeenCalled()

const FORMATS = [
  { name: 'Image', Screen: ImageShareScreen, download: 'Download PNG', copy: 'Copy image', share: 'Share' },
  { name: 'TV', Screen: TvShareScreen, download: 'Download PNG', copy: 'Copy image', share: 'Share' },
  { name: 'PDF', Screen: PdfShareScreen, download: 'Download PDF', copy: null, share: 'Share' },
]

for (const { name, Screen, download, copy, share } of FORMATS) {
  describe(`${name} screen with a changed name setting`, () => {
    it('hands nothing out from the old file between the change and the new file', async () => {
      const { rerender } = renderScreen(<Screen {...makeScreenProps()} />)
      await waitFor(() => expect(screen.getByRole('button', { name: download })).toBeEnabled())
      expect(screen.getByRole('button', { name: share })).toBeInTheDocument()

      rerender(themed(<Screen {...flipped()} />))

      // At once: no Share, Download (and Copy image or Print) disabled, so no click hands out the stale file.
      expect(screen.queryByRole('button', { name: share })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: download })).toBeDisabled()
      if (copy) expect(screen.getByRole('button', { name: copy })).toBeDisabled()
      else expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: download }))
      onlyOneCall()

      // Then the file for the new input exists and the actions come back.
      await waitFor(() => expect(screen.getByRole('button', { name: download })).toBeEnabled())
      await userEvent.click(screen.getByRole('button', { name: download }))
      expect(downloadFile).toHaveBeenCalledTimes(1)
    })
  })
}

describe('WhatsApp screen attached image with a changed name setting', () => {
  it('disables Copy image and Download image from the moment the model changes', async () => {
    const { rerender } = renderScreen(<WhatsAppShareScreen {...makeScreenProps()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download image' })).toBeEnabled())

    rerender(themed(<WhatsAppShareScreen {...flipped()} />))

    expect(screen.getByRole('button', { name: 'Download image' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Copy image' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Download image' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy image' }))
    onlyOneCall()
    expect(navigator.clipboard.write).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download image' })).toBeEnabled())
  })
})
