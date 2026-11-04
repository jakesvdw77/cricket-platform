import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AddPollChooserDialog } from './AddPollChooserDialog'

function Probe() {
  const location = useLocation()
  return <div>{`At ${location.pathname}${location.search}`}</div>
}

function renderChooser(props: { sectionId?: string | null; onClose?: () => void } = {}) {
  const onClose = props.onClose ?? vi.fn()
  render(
    <MemoryRouter initialEntries={['/manage/availability?showClosed=true']}>
      <Routes>
        <Route path="/manage/availability" element={<AddPollChooserDialog open onClose={onClose} sectionId={props.sectionId} />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
  return { onClose }
}

describe('AddPollChooserDialog (docs/specs/136)', () => {
  it('offers a Squad Poll and a Group Poll tile with their explanations and a Cancel', () => {
    renderChooser()

    expect(screen.getByRole('dialog', { name: 'Create New Poll' })).toBeInTheDocument()
    expect(screen.getByText("Ask one team's squad about one or more of its matches. Each match gets its own link.")).toBeInTheDocument()
    expect(screen.getByText('Ask a whole section about several fixtures. One link covers them all.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('a Squad Poll tile goes straight to the new poll page carrying returnTo and the origin label', async () => {
    const { onClose } = renderChooser()

    await userEvent.setup().click(screen.getByRole('button', { name: /^Squad Poll/ }))

    expect(onClose).toHaveBeenCalled()
    const at = (await screen.findByText(/^At \/manage\/availability\/new/)).textContent ?? ''
    expect(at).toContain('type=squad')
    expect(decodeURIComponent(at)).toContain('returnTo=/manage/availability?showClosed=true')
    expect(at).toContain('returnLabel=Availability')
  })

  it('a Group Poll tile passes the hub section along', async () => {
    renderChooser({ sectionId: 'sec-1' })

    await userEvent.setup().click(screen.getByRole('button', { name: /^Group Poll/ }))

    const at = (await screen.findByText(/^At \/manage\/availability\/new/)).textContent ?? ''
    expect(at).toContain('type=group')
    expect(at).toContain('sectionId=sec-1')
  })

  it('Cancel closes without navigating', async () => {
    const { onClose } = renderChooser()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByText(/^At /)).not.toBeInTheDocument()
  })
})
