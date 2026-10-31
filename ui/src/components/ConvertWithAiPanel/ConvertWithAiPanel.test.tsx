import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConvertWithAiPanel } from './ConvertWithAiPanel'

describe('ConvertWithAiPanel', () => {
  it('copies exactly the prompt it was given', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<ConvertWithAiPanel prompt={'Turn this into rows.\nSecond line.'} open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /copy prompt/i }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Turn this into rows.\nSecond line.'))
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  })

  it('has no prompt to copy while it is loading', () => {
    render(<ConvertWithAiPanel loading open onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /copy prompt/i })).toBeDisabled()
  })

  it('offers the template download', () => {
    const onDownloadTemplate = vi.fn()
    render(<ConvertWithAiPanel prompt="p" onDownloadTemplate={onDownloadTemplate} open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /download template/i }))
    expect(onDownloadTemplate).toHaveBeenCalled()
  })

  it('is a titled dialog that closes from its Close button, and renders nothing while closed', async () => {
    const onClose = vi.fn()
    const { rerender } = render(<ConvertWithAiPanel prompt="p" open onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: 'Convert your file with AI' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
    rerender(<ConvertWithAiPanel prompt="p" open={false} onClose={onClose} />)
    await waitFor(() => expect(screen.queryByRole('button', { name: /copy prompt/i })).not.toBeInTheDocument())
  })
})
