import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DetailLine } from './DetailLine'

describe('DetailLine', () => {
  it('renders the label and value with the default 56px label column', () => {
    render(<DetailLine icon={<span data-testid="icon" />} label="When" value="Sat 3 Oct" />)

    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('When')).toHaveStyle({ width: '56px' })
    expect(screen.getByText('Sat 3 Oct')).toBeInTheDocument()
  })

  it('applies a custom labelWidth', () => {
    render(<DetailLine icon={null} label="First match" value="x" labelWidth={78} />)

    expect(screen.getByText('First match')).toHaveStyle({ width: '78px' })
  })

  it('renders a ReactNode value', () => {
    render(<DetailLine icon={null} label="Next" value={<span data-testid="rich">date <b>badge</b></span>} />)

    expect(screen.getByTestId('rich')).toHaveTextContent('date badge')
  })

  it('renders a muted value in regular weight, and a normal one in semibold', () => {
    render(
      <>
        <DetailLine icon={null} label="A" value="Not scheduled yet" muted />
        <DetailLine icon={null} label="B" value="A real value" />
      </>,
    )

    expect(screen.getByText('Not scheduled yet')).toHaveStyle({ fontWeight: '400' })
    expect(screen.getByText('A real value')).toHaveStyle({ fontWeight: '600' })
  })
})
