import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { JsonEditor } from './JsonEditor'

function Host({ initial = '', disabled = false }: { initial?: string; disabled?: boolean }) {
  const [value, setValue] = useState(initial)
  return <JsonEditor value={value} onChange={setValue} ariaLabel="Pasted result content" disabled={disabled} />
}

describe('JsonEditor', () => {
  it('is a labelled text box that takes typed and pasted text', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const box = screen.getByLabelText('Pasted result content')
    await user.click(box)
    await user.paste('{"a": 1}')
    expect(box).toHaveValue('{"a": 1}')
  })

  it('colours properties, strings, numbers and keywords as separate tokens', () => {
    const { container } = render(<Host initial={'{ "name": "Anna", "runs": 30, "out": true, "x": null }'} />)
    expect(container.querySelector('.token.property')).toHaveTextContent('"name"')
    expect(container.querySelector('.token.string')).toHaveTextContent('"Anna"')
    expect(container.querySelector('.token.number')).toHaveTextContent('30')
    expect(container.querySelectorAll('.token.boolean, .token.null')).toHaveLength(2)
  })

  it('still shows text that is not JSON, uncoloured, instead of rejecting it', () => {
    render(<Host initial="not json at all" />)
    expect(screen.getByLabelText('Pasted result content')).toHaveValue('not json at all')
  })

  it('cannot be edited while disabled', () => {
    render(<Host initial="{}" disabled />)
    expect(screen.getByLabelText('Pasted result content')).toBeDisabled()
  })
})
