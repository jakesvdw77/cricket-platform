import { ThemeProvider } from '@mui/material/styles'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { baseTheme } from '../../../theme'
import { zebraTint } from '../../../utils/zebraTint'
import { SelectionBlock } from './SelectionBlock'

describe('SelectionBlock', () => {
  it('shows "N of M picked", a determinate bar and "N picked · K to go"', () => {
    render(<SelectionBlock rows={[{ teamName: '1st XI', picked: 7, playingXiSize: 11 }]} />)

    expect(screen.getByText('1st XI')).toBeInTheDocument()
    expect(screen.getByText('7 of 11 picked')).toBeInTheDocument()
    expect(screen.getByText('7 picked · 4 to go')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', { name: '1st XI selection' })
    expect(bar).toHaveAttribute('aria-valuenow', '7')
    expect(bar).toHaveAttribute('aria-valuemax', '11')
    expect(bar).toHaveAttribute('aria-valuetext', '7 of 11 picked')
    expect(within(bar).getByTestId('selection-bar-fill')).toHaveStyle({ width: `${(7 / 11) * 100}%` })
  })

  it('reads "squad complete" at M of M', () => {
    render(<SelectionBlock rows={[{ teamName: '1st XI', picked: 11, playingXiSize: 11 }]} />)

    expect(screen.getByText('11 of 11 picked')).toBeInTheDocument()
    expect(screen.getByText('squad complete')).toBeInTheDocument()
    expect(screen.queryByText(/to go/)).not.toBeInTheDocument()
    expect(screen.getByTestId('selection-bar-fill')).toHaveStyle({ width: '100%' })
  })

  it('shows an empty bar and every player still to go at zero picked', () => {
    render(<SelectionBlock rows={[{ teamName: '1st XI', picked: 0, playingXiSize: 11 }]} />)

    expect(screen.getByText('0 picked · 11 to go')).toBeInTheDocument()
    expect(screen.getByTestId('selection-bar-fill')).toHaveStyle({ width: '0%' })
  })

  it('shows just "N picked" with no bar when there is no league', () => {
    render(<SelectionBlock rows={[{ teamName: '1st XI', picked: 5, playingXiSize: null }]} />)

    expect(screen.getByText('5 picked')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/of \d+ picked/)).not.toBeInTheDocument()
  })

  it('renders one row per team for a derby', () => {
    render(
      <SelectionBlock
        rows={[
          { teamName: '1st XI', picked: 11, playingXiSize: 11 },
          { teamName: '2nd XI', picked: 3, playingXiSize: 11 },
        ]}
      />,
    )

    expect(screen.getAllByRole('progressbar')).toHaveLength(2)
    expect(screen.getByText('11 of 11 picked')).toBeInTheDocument()
    expect(screen.getByText('3 of 11 picked')).toBeInTheDocument()
  })

  it('shows the nobody-to-pick note when there are no rows', () => {
    render(<SelectionBlock rows={[]} />)

    expect(screen.getByText('Neither side is one of your teams, so there is nobody to pick.')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  // docs/specs/087
  describe('zebra rows', () => {
    const rows = [
      { teamName: 'Vets A', picked: 12, playingXiSize: 12 },
      { teamName: 'Vets B', picked: 4, playingXiSize: 12 },
      { teamName: 'Vets C', picked: 0, playingXiSize: null },
    ]

    function rowOf(name: string) {
      // The row is the ancestor whose parent (the rows container) is a direct child of the selection block.
      let element = screen.getByText(name)
      while (element.parentElement && element.parentElement.parentElement?.getAttribute('data-testid') !== 'selection-block') {
        element = element.parentElement
      }
      return element
    }

    it('tints the first, third ... team row with the shared zebra tint and leaves the others plain', () => {
      render(
        <ThemeProvider theme={baseTheme}>
          <SelectionBlock rows={rows} />
        </ThemeProvider>,
      )
      const tint = zebraTint(baseTheme)
      expect(rowOf('Vets A')).toHaveStyle({ backgroundColor: tint })
      expect(rowOf('Vets C')).toHaveStyle({ backgroundColor: tint })
      expect(rowOf('Vets B')).not.toHaveStyle({ backgroundColor: tint })
    })

    it('shows a single row tinted', () => {
      render(
        <ThemeProvider theme={baseTheme}>
          <SelectionBlock rows={[rows[0]]} />
        </ThemeProvider>,
      )
      expect(rowOf('Vets A')).toHaveStyle({ backgroundColor: zebraTint(baseTheme) })
    })
  })
})
