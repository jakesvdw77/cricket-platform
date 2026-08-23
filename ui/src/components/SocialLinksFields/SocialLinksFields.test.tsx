import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SocialLinksFields } from './SocialLinksFields'
import type { SocialLink } from '../marketing/SocialLinksRow'

describe('SocialLinksFields', () => {
  it('renders "No social links added yet." when value is empty', () => {
    render(<SocialLinksFields value={[]} onChange={vi.fn()} />)

    expect(screen.getByText('No social links added yet.')).toBeInTheDocument()
  })

  it('"Add link" appends a row defaulting to the first unused known platform', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SocialLinksFields value={[]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Add link' }))

    expect(onChange).toHaveBeenCalledWith([{ platform: 'facebook', url: '' }])
  })

  it('once all 10 known platforms are in use, "Add link" appends a new row already in Custom mode', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const allTenUsed: SocialLink[] = [
      'facebook',
      'instagram',
      'x',
      'tiktok',
      'youtube',
      'linkedin',
      'whatsapp',
      'threads',
      'pinterest',
      'snapchat',
    ].map((platform) => ({ platform, url: 'https://example.com/x' }))
    const { rerender } = render(<SocialLinksFields value={allTenUsed} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Add link' }))

    expect(onChange).toHaveBeenCalledWith([...allTenUsed, { platform: '', url: '' }])
    // Re-render with the appended row applied (as the real controlled parent would do), and
    // confirm the new (11th) row rendered in Custom mode — a free-text Platform Input, not a
    // Select. Reuses the same component instance (rerender, not a fresh mount) since the "new
    // row is in custom mode" fact lives in handleAdd's own internal setRowState call, exactly as
    // it would for the real controlled parent re-rendering with onChange's result applied.
    rerender(<SocialLinksFields value={[...allTenUsed, { platform: '', url: '' }]} onChange={onChange} />)
    const platformInputs = screen.getAllByLabelText('Platform')
    expect(platformInputs).toHaveLength(11)
    expect(platformInputs[10].tagName).toBe('INPUT')
    expect(platformInputs[10]).not.toHaveAttribute('role', 'combobox')
  })

  it('selecting "Custom…" swaps the platform Select for a free-text Input, and typing in it calls onChange with that row\'s platform updated', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const value: SocialLink[] = [{ platform: 'facebook', url: 'https://facebook.com/cricketlegend' }]
    const { rerender } = render(<SocialLinksFields value={value} onChange={onChange} />)

    await user.click(screen.getByLabelText('Platform'))
    await user.click(await screen.findByRole('option', { name: 'Custom…' }))

    expect(onChange).toHaveBeenCalledWith([{ platform: '', url: 'https://facebook.com/cricketlegend' }])

    // Apply the onChange result and re-render — the row's own local "custom mode" state persists
    // across the re-render even though the platform string is now blank.
    rerender(
      <SocialLinksFields
        value={[{ platform: '', url: 'https://facebook.com/cricketlegend' }]}
        onChange={onChange}
      />,
    )

    const platformInput = screen.getByLabelText('Platform')
    expect(platformInput.tagName).toBe('INPUT')

    // A single keystroke, matching AddressFields.test.tsx's own precedent for a controlled-input
    // onChange assertion — the row's platform prop is pinned to '' for the duration of this test
    // (no wrapper component threads onChange's result back into `value` between keystrokes), so a
    // multi-character user.type would only ever surface its last keystroke's target value here.
    await user.type(platformInput, 'D')

    expect(onChange).toHaveBeenLastCalledWith([
      { platform: 'D', url: 'https://facebook.com/cricketlegend' },
    ])
  })

  it('selecting a known platform from the dropdown updates that row\'s platform', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const value: SocialLink[] = [{ platform: 'facebook', url: 'https://facebook.com/cricketlegend' }]
    render(<SocialLinksFields value={value} onChange={onChange} />)

    await user.click(screen.getByLabelText('Platform'))
    await user.click(await screen.findByRole('option', { name: 'Instagram' }))

    expect(onChange).toHaveBeenCalledWith([
      { platform: 'instagram', url: 'https://facebook.com/cricketlegend' },
    ])
  })

  it("a row's platform Select excludes platforms already used by other rows, but still shows its own current selection", async () => {
    const user = userEvent.setup()
    const value: SocialLink[] = [
      { platform: 'facebook', url: 'https://facebook.com/cricketlegend' },
      { platform: 'instagram', url: 'https://instagram.com/cricketlegend' },
    ]
    render(<SocialLinksFields value={value} onChange={vi.fn()} />)

    const platformSelects = screen.getAllByLabelText('Platform')
    // First row is currently "facebook" — opening its own Select still shows Facebook (its own
    // current selection) but not Instagram (used by the other row).
    await user.click(platformSelects[0])
    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getByRole('option', { name: 'Facebook' })).toBeInTheDocument()
    expect(within(listbox).queryByRole('option', { name: 'Instagram' })).not.toBeInTheDocument()
  })

  it('the remove button removes the correct row via onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const value: SocialLink[] = [
      { platform: 'facebook', url: 'https://facebook.com/cricketlegend' },
      { platform: 'instagram', url: 'https://instagram.com/cricketlegend' },
    ]
    render(<SocialLinksFields value={value} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Remove instagram' }))

    expect(onChange).toHaveBeenCalledWith([{ platform: 'facebook', url: 'https://facebook.com/cricketlegend' }])
  })

  it('shows an inline error for a blank platform', () => {
    const value: SocialLink[] = [{ platform: '', url: 'https://example.com' }]
    render(<SocialLinksFields value={value} onChange={vi.fn()} />)

    expect(screen.getByText('Platform is required')).toBeInTheDocument()
  })

  it('shows an inline error on both rows for a duplicate platform across two rows', () => {
    const value: SocialLink[] = [
      { platform: 'Discord', url: 'https://discord.gg/one' },
      { platform: 'Discord', url: 'https://discord.gg/two' },
    ]
    render(<SocialLinksFields value={value} onChange={vi.fn()} />)

    expect(screen.getAllByText('This platform has already been added')).toHaveLength(2)
  })

  it('shows an inline error for a blank URL', () => {
    const value: SocialLink[] = [{ platform: 'facebook', url: '' }]
    render(<SocialLinksFields value={value} onChange={vi.fn()} />)

    expect(screen.getByText('URL is required')).toBeInTheDocument()
  })

  it('shows an inline error for a malformed URL', () => {
    const value: SocialLink[] = [{ platform: 'facebook', url: 'not-a-url' }]
    render(<SocialLinksFields value={value} onChange={vi.fn()} />)

    expect(screen.getByText('Enter a valid URL, e.g. https://example.com')).toBeInTheDocument()
  })
})
