import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StatusScreen } from './StatusScreen'
import type { StatusKind } from './StatusScreen'

const KINDS: Array<[StatusKind, string, string]> = [
  ['not-authorised', 'Not out, but not in either', 'You do not have access to this area'],
  ['signed-out', 'Stumps for today', 'You have been signed out'],
  ['suspended', 'Play is suspended', 'Your account is disabled. Please contact your club.'],
  ['session-expired', 'Your innings has ended', 'Your session has expired'],
  ['not-found', 'Not on the scorecard', 'We cannot find that page'],
  ['unreachable', 'Rain stopped play', 'We cannot reach the server right now. Check your connection and try again.'],
  ['error', 'Dropped catch', 'Something went wrong on our side'],
]

describe('StatusScreen', () => {
  it.each(KINDS)('%s shows its heading, sentence and illustration on the backdrop', (kind, title, message) => {
    render(<StatusScreen kind={kind} />)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(screen.getByText(new RegExp(message))).toBeInTheDocument()
    expect(screen.getByTestId('status-illustration')).toHaveAttribute('data-kind', kind)
    expect(screen.getByTestId('page-backdrop')).toBeInTheDocument()
    expect(screen.getByText('Cricket Legend')).toBeInTheDocument()
  })

  it('takes title and message overrides', () => {
    render(<StatusScreen kind="error" title="Custom title" message="Custom words" />)
    expect(screen.getByRole('heading', { name: 'Custom title' })).toBeInTheDocument()
    expect(screen.getByText('Custom words')).toBeInTheDocument()
  })

  it('runs the supplied actions, and a link action is a link', () => {
    const onClick = vi.fn()
    render(<StatusScreen kind="not-authorised" primaryAction={{ label: 'Back to home', href: '/' }} secondaryAction={{ label: 'Sign out', onClick }} />)
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('has default actions per kind and null removes them', () => {
    const { unmount } = render(<StatusScreen kind="session-expired" />)
    expect(screen.getByRole('link', { name: 'Sign in again' })).toHaveAttribute('href', '/login')
    unmount()
    render(<StatusScreen kind="unreachable" primaryAction={null} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
