import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FlipCard, useFaceTabIndex } from './FlipCard'

// docs/specs/147 section 4 and Acceptance 2 and 3: one real button over two faces that are always in the accessibility tree.
function Face({ name }: { name: string }) {
  const tabIndex = useFaceTabIndex()
  return <a href={`/${name}`} tabIndex={tabIndex}>{`${name} link`}</a>
}

const card = (props: Partial<React.ComponentProps<typeof FlipCard>> = {}) => (
  <FlipCard label="Runs" front={<Face name="front" />} back={<Face name="back" />} {...props} />
)

function setReducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia
})

describe('FlipCard', () => {
  it('is one real button named "Flip <label>" with aria-pressed false on the front', () => {
    render(card())
    const button = screen.getByRole('button', { name: 'Flip Runs' })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('flip-card')).toHaveAttribute('data-flipped', 'false')
  })

  it('flips on click and again on click, pressing and releasing the button', async () => {
    const user = userEvent.setup()
    render(card())
    const button = screen.getByRole('button', { name: 'Flip Runs' })
    await user.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('flip-card')).toHaveAttribute('data-flipped', 'true')
    await user.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('flips with Enter and with Space when the button has focus', async () => {
    const user = userEvent.setup()
    render(card())
    const button = screen.getByRole('button', { name: 'Flip Runs' })
    button.focus()
    await user.keyboard('{Enter}')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard(' ')
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps both faces in the accessibility tree, front then back, whichever shows', async () => {
    const user = userEvent.setup()
    render(card())
    const front = screen.getByRole('group', { name: 'Front' })
    const back = screen.getByRole('group', { name: 'Back' })
    expect(front.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const face of [front, back]) {
      expect(face).not.toHaveAttribute('aria-hidden')
      expect(face).not.toHaveStyle({ display: 'none' })
      expect(face).not.toHaveStyle({ visibility: 'hidden' })
    }
    await user.click(screen.getByRole('button', { name: 'Flip Runs' }))
    expect(screen.getByRole('group', { name: 'Front' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'front link' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'back link' })).toBeInTheDocument()
  })

  it('takes controls on the hidden face out of the tab order, and puts them back on a flip', async () => {
    const user = userEvent.setup()
    render(card())
    const frontLink = screen.getByRole('link', { name: 'front link' })
    const backLink = screen.getByRole('link', { name: 'back link' })
    expect(frontLink).not.toHaveAttribute('tabindex')
    expect(backLink).toHaveAttribute('tabindex', '-1')
    await user.click(screen.getByRole('button', { name: 'Flip Runs' }))
    expect(frontLink).toHaveAttribute('tabindex', '-1')
    expect(backLink).not.toHaveAttribute('tabindex')
  })

  it('starts on the back with defaultFlipped, and a scope change puts an uncontrolled card back to its start', async () => {
    const user = userEvent.setup()
    const { rerender } = render(card({ scopeKey: 'a' }))
    await user.click(screen.getByRole('button', { name: 'Flip Runs' }))
    expect(screen.getByTestId('flip-card')).toHaveAttribute('data-flipped', 'true')
    rerender(card({ scopeKey: 'b' }))
    expect(screen.getByTestId('flip-card')).toHaveAttribute('data-flipped', 'false')

    const start = render(card({ defaultFlipped: true, scopeKey: 'a' }))
    expect(within(start.container).getByTestId('flip-card')).toHaveAttribute('data-flipped', 'true')
  })

  it('is controlled with flipped and onFlip: the parent decides the side', async () => {
    const user = userEvent.setup()
    const onFlip = vi.fn()
    function Controlled() {
      const [flipped, setFlipped] = useState(false)
      return card({ flipped, onFlip: (next) => { onFlip(next); setFlipped(next) } })
    }
    render(<Controlled />)
    await user.click(screen.getByRole('button', { name: 'Flip Runs' }))
    expect(onFlip).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: 'Flip Runs' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('points aria-describedby at the summary element', () => {
    render(<><p id="why">A summary.</p>{card({ describedBy: 'why' })}</>)
    expect(screen.getByRole('button', { name: 'Flip Runs' })).toHaveAccessibleDescription('A summary.')
  })

  it('rotates the faces about the Y axis normally', async () => {
    const user = userEvent.setup()
    render(card())
    expect(screen.getByTestId('flip-card-back')).toHaveStyle({ transform: 'rotateY(180deg)' })
    await user.click(screen.getByRole('button', { name: 'Flip Runs' }))
    expect(screen.getByTestId('flip-card-front').parentElement).toHaveStyle({ transform: 'rotateY(180deg)' })
  })

  it('uses a fade and no rotation under reduced motion', async () => {
    setReducedMotion(true)
    const user = userEvent.setup()
    render(card())
    const front = screen.getByTestId('flip-card-front')
    const back = screen.getByTestId('flip-card-back')
    expect(front).toHaveStyle({ opacity: '1' })
    expect(back).toHaveStyle({ opacity: '0' })
    expect(back).not.toHaveStyle({ transform: 'rotateY(180deg)' })
    await user.click(screen.getByRole('button', { name: 'Flip Runs' }))
    expect(front).toHaveStyle({ opacity: '0' })
    expect(back).toHaveStyle({ opacity: '1' })
    expect(front.parentElement).not.toHaveStyle({ transform: 'rotateY(180deg)' })
  })
})
