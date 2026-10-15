import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { baseTheme } from '../../../../theme'
import { ConvertWithAiHelper } from './ConvertWithAiHelper'

const PROMPT = 'Convert the attached scorecard.\nReturn one JSON code block.'

const renderHelper = () =>
  render(
    <ThemeProvider theme={baseTheme}>
      <ConvertWithAiHelper prompt={PROMPT} />
    </ThemeProvider>,
  )

afterEach(() => vi.restoreAllMocks())

describe('ConvertWithAiHelper', () => {
  it('is collapsed by default and opens from its heading', async () => {
    const user = userEvent.setup()
    renderHelper()
    const heading = screen.getByRole('button', { name: /Convert it with your own AI/ })
    expect(heading).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Copy prompt' })).not.toBeInTheDocument()

    await user.click(heading)
    expect(heading).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByRole('button', { name: 'Copy prompt' })).toBeVisible()
  })

  it('copies the exact prompt text and announces Copied', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    renderHelper()
    // Replaced after userEvent.setup(), which installs its own clipboard stub.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    await user.click(screen.getByRole('button', { name: /Convert it with your own AI/ }))
    await user.click(screen.getByRole('button', { name: 'Copy prompt' }))

    expect(writeText).toHaveBeenCalledWith(PROMPT)
    expect(await screen.findByText('Copied')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
  })

  it('tells the manager when copying failed and points at Show prompt', async () => {
    const user = userEvent.setup()
    renderHelper()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
    // No fallback either: execCommand is unavailable.
    document.execCommand = vi.fn().mockReturnValue(false)

    await user.click(screen.getByRole('button', { name: /Convert it with your own AI/ }))
    await user.click(screen.getByRole('button', { name: 'Copy prompt' }))

    expect(await screen.findByText(/Could not copy/)).toBeInTheDocument()
  })

  it('shows and hides the prompt text on request', async () => {
    const user = userEvent.setup()
    renderHelper()
    await user.click(screen.getByRole('button', { name: /Convert it with your own AI/ }))
    expect(screen.queryByLabelText('Conversion prompt')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show prompt' }))
    expect(screen.getByLabelText('Conversion prompt')).toHaveTextContent('Convert the attached scorecard.')
    await user.click(screen.getByRole('button', { name: 'Hide prompt' }))
    expect(screen.queryByLabelText('Conversion prompt')).not.toBeInTheDocument()
  })

  it('carries the red disclaimer with a warning icon: the file goes to the AI the manager chooses', async () => {
    const user = userEvent.setup()
    renderHelper()
    await user.click(screen.getByRole('button', { name: /Convert it with your own AI/ }))

    const disclaimer = screen.getByText(/Your file goes to the AI you choose, not through us/)
    expect(disclaimer).toHaveTextContent("children's names")
    expect(disclaimer.parentElement?.querySelector('svg[data-testid="ReportProblemOutlinedIcon"]')).not.toBeNull()
    expect(getComputedStyle(disclaimer).color).toBe(baseTheme.palette.error.main.startsWith('#') ? hexToRgb(baseTheme.palette.error.main) : baseTheme.palette.error.main)
  })
})

function hexToRgb(hex: string): string {
  const value = parseInt(hex.slice(1), 16)
  return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`
}
