import { act, render, renderHook, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { PlayerName } from './PlayerName'
import { usePlayerLabeler } from '../../hooks/usePlayerLabeler'
import { resetPlayerNameModeForTests, usePlayerNameMode } from '../../hooks/usePlayerNameMode'
import { splitName } from '../../utils/playerDisplayName'
import type { PersonName } from '../../utils/playerDisplayName'

const venter: PersonName = { id: 'a', firstName: 'Sam', lastName: 'Venter' }
const vdw: PersonName = { id: 'b', firstName: 'Sam', lastName: 'van der Westhuizen' }
const guest: PersonName = { id: 'g', ...splitName('Sam Botha') }

describe('PlayerName', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPlayerNameModeForTests()
  })

  it('shows the full name by default', () => {
    render(<PlayerName person={venter} view={[venter, vdw]} />)
    expect(screen.getByText('Sam Venter')).toBeInTheDocument()
  })

  it('shows the first initial and the whole surname in initials mode', () => {
    const { rerender } = render(<PlayerName person={venter} view={[venter]} mode="initials" />)
    expect(screen.getByText('S. Venter')).toBeInTheDocument()

    rerender(<PlayerName person={vdw} view={[venter, vdw]} mode="initials" />)
    expect(screen.getByText('S. van der Westhuizen')).toBeInTheDocument()
  })

  it('shows a guest the same way', () => {
    render(<PlayerName person={guest} view={[venter, guest]} mode="initials" />)
    expect(screen.getByText(/^S\. /)).toBeInTheDocument()
  })

  it('follows the remembered mode, and changes with it', () => {
    render(<PlayerName person={venter} view={[venter, vdw]} />)
    const toggle = renderHook(() => usePlayerNameMode())
    expect(screen.getByText('Sam Venter')).toBeInTheDocument()

    act(() => toggle.result.current[1]('initials'))
    expect(screen.getByText('S. Venter')).toBeInTheDocument()
  })

  it('usePlayerLabeler gives the same label as a string', () => {
    const { result } = renderHook(() => usePlayerLabeler([venter, vdw], 'initials'))
    expect(result.current(venter)).toBe('S. Venter')
    expect(result.current(vdw)).toBe('S. van der Westhuizen')
  })
})
