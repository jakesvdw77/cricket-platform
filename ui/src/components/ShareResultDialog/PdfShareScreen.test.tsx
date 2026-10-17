import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PdfShareScreen } from './PdfShareScreen'
import { makeScreenProps, mockCanvas, renderScreen, setInitials, updateChoices } from './shareScreenTestUtils'

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

beforeEach(() => {
  vi.clearAllMocks()
  const context = mockCanvas()
  Object.assign(context, { stroke: vi.fn(), lineTo: vi.fn() })
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() }))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
})

describe('PdfShareScreen', () => {
  it('shows the page preview with its label and the template, teams, include and logo controls', async () => {
    renderScreen(<PdfShareScreen {...makeScreenProps()} />)

    expect(screen.getByRole('img', { name: /PDF scorecard, page 1: Riverside 1 won by 24 runs/ })).toBeInTheDocument()
    for (const name of ['Club colours', 'Classic', 'Compact', 'Both teams', 'Our team only']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    for (const name of ['Initials only', 'Batting', 'Bowling', 'Extras', 'Toss and conditions', 'Player of the match', 'Club logo', 'Team logos', 'Footer line']) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument()
    }
  })

  it('remembers a changed template, include switch and footer line through updateChoices', async () => {
    renderScreen(<PdfShareScreen {...makeScreenProps()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Compact' }))
    expect(updateChoices).toHaveBeenLastCalledWith({ templates: expect.objectContaining({ pdf: 'COMPACT' }) })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Bowling' }))
    expect(updateChoices).toHaveBeenLastCalledWith({
      include: expect.objectContaining({ pdf: expect.objectContaining({ bowling: false }) }),
    })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Footer line' }))
    expect(updateChoices).toHaveBeenLastCalledWith({ footerLine: false })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Initials only' }))
    expect(setInitials).toHaveBeenCalledWith(true)
  })

  it('offers Download PDF and Print where the browser cannot share files', async () => {
    renderScreen(<PdfShareScreen {...makeScreenProps()} />)

    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled()
  })

  it('offers Share, handing over the PDF named after the teams, where the browser can share files, and a cancel is silent', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    renderScreen(<PdfShareScreen {...makeScreenProps()} />)

    const button = await screen.findByRole('button', { name: 'Share' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)

    const arg = share.mock.calls[0][0] as { files: File[]; title: string }
    expect(arg.files[0].name).toBe('Riverside 1 v Pretoria CC 2026-10-17.pdf')
    expect(arg.title).toBe('Riverside 1 v Pretoria CC')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('opens the PDF in a new tab for Print', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderScreen(<PdfShareScreen {...makeScreenProps()} />)

    const print = await screen.findByRole('button', { name: 'Print' })
    await waitFor(() => expect(print).toBeEnabled())
    await userEvent.click(print)

    expect(open).toHaveBeenCalledWith('blob:pdf', '_blank')
  })
})
