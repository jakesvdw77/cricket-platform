import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Sponsor } from '../../api/sponsorApi'
import { MAX_SHARE_SPONSORS } from '../../utils/share/logoLayout'
import { ShareSponsorChooser } from './ShareSponsorChooser'

// docs/specs/114-share-result.md (Logos and footer): the sponsor chooser caps at four.
const sponsor = (id: string): Sponsor =>
  ({ id, name: `Sponsor ${id}`, logoUrl: `https://x/${id}.png`, active: true }) as unknown as Sponsor
const six = ['a', 'b', 'c', 'd', 'e', 'f'].map(sponsor)

describe('ShareSponsorChooser', () => {
  it('says so when there is no sponsor with a logo to choose from', () => {
    render(<ShareSponsorChooser sponsors={[]} selectedIds={[]} max={MAX_SHARE_SPONSORS} onChange={vi.fn()} />)

    expect(screen.getByText('No sponsors with a logo to choose from.')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('ticks and unticks, passing the ids in the order chosen', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<ShareSponsorChooser sponsors={six} selectedIds={[]} max={4} onChange={onChange} />)

    await userEvent.click(screen.getByRole('checkbox', { name: 'Sponsor b' }))
    expect(onChange).toHaveBeenLastCalledWith(['b'])

    rerender(<ShareSponsorChooser sponsors={six} selectedIds={['b']} max={4} onChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sponsor a' }))
    expect(onChange).toHaveBeenLastCalledWith(['b', 'a'])
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sponsor b' }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('caps the choice at four: the rest are disabled and a reason is shown, and unticking frees a place', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<ShareSponsorChooser sponsors={six} selectedIds={['a', 'b', 'c']} max={MAX_SHARE_SPONSORS} onChange={onChange} />)
    expect(screen.getByRole('checkbox', { name: 'Sponsor d' })).toBeEnabled()
    expect(screen.queryByText(/The most you can show is 4/)).not.toBeInTheDocument()

    rerender(<ShareSponsorChooser sponsors={six} selectedIds={['a', 'b', 'c', 'd']} max={MAX_SHARE_SPONSORS} onChange={onChange} />)
    expect(screen.getByRole('checkbox', { name: 'Sponsor e' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Sponsor f' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Sponsor a' })).toBeEnabled()
    expect(screen.getByText('The most you can show is 4. Untick one to choose another.')).toBeInTheDocument()
    expect(screen.getByText('Sponsors to show (up to 4): 4 chosen')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Sponsor a' }))
    expect(onChange).toHaveBeenLastCalledWith(['b', 'c', 'd'])
  })
})
