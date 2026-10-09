import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlayerInfoCard } from './PlayerInfoCard'

describe('PlayerInfoCard', () => {
  it('renders the heading and label-over-value fields, with a dash for empty values', () => {
    render(
      <PlayerInfoCard
        title="Basic info"
        icon={<span />}
        fields={[
          { label: 'Gender', value: 'Male' },
          { label: 'Club membership number', value: null },
          { label: 'Other', value: '' },
        ]}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Basic info' })).toBeInTheDocument()
    const fields = screen.getAllByTestId('player-info-field')
    expect(within(fields[0]).getByText('Male')).toBeInTheDocument()
    expect(within(fields[1]).getByText('–')).toBeInTheDocument()
    expect(within(fields[2]).getByText('–')).toBeInTheDocument()
  })

  it('renders chips marking those not on file', () => {
    render(
      <PlayerInfoCard
        title="Cricket info"
        icon={<span />}
        chips={[
          { label: 'Bats: Left-handed', on: true },
          { label: 'Wicketkeeper: No', on: false },
        ]}
      />,
    )
    const chips = screen.getAllByTestId('player-info-chip')
    expect(chips.map((chip) => chip.getAttribute('data-on'))).toEqual(['true', 'false'])
  })

  it('renders the note and the actions', () => {
    render(
      <PlayerInfoCard title="Stats" icon={<span />} note="More coming soon" actions={<a href="tel:1">Call</a>} />,
    )
    expect(screen.getByText('More coming soon')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Call' })).toBeInTheDocument()
  })
})
