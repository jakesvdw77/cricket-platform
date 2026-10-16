import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ImportProblem } from '../../../../api/importErrors'
import { ImportProblemAlert } from './ImportProblemAlert'

const problem = (overrides: Partial<ImportProblem>): ImportProblem => ({ kind: 'other', status: null, message: 'Something went wrong.', errors: [], totalErrors: 0, supported: [], otherMatchId: null, ...overrides })
const alertText = () => screen.getByTestId('import-problem')

describe('ImportProblemAlert', () => {
  it('lists validation errors with copyable paths, the source name and "and N more"', () => {
    const errors = [{ path: 'innings[0].total', code: 'BAD', message: 'Total does not add up.' }]
    render(<ImportProblemAlert problem={problem({ kind: 'validation', errors, totalErrors: 4 })} sourceName="Cricket Legend JSON" input="paste" />)
    expect(alertText()).toHaveTextContent('This content is not valid for Cricket Legend JSON')
    expect(alertText()).toHaveTextContent('What you pasted is still here.')
    expect(within(alertText()).getByRole('button', { name: 'Copy path innings[0].total' })).toBeInTheDocument()
    expect(within(alertText()).getByText('and 3 more')).toBeInTheDocument()
  })

  it.each<[ImportProblem['kind'], Partial<ImportProblem>, string, string]>([
    ['unsupported', { supported: ['JSON', 'CSV'], message: 'No such format.' }, 'This source does not read that format', 'It reads: JSON, CSV.'],
    ['unreadable', { message: 'Not valid JSON.' }, "We couldn't read this", 'Not valid JSON.'],
    ['too-large', { message: 'Over the limit.' }, 'This is too large', 'Over the limit.'],
    ['conflict', { message: 'Already imported.' }, 'That did not work', 'Already imported.'],
    ['forbidden', { message: 'You cannot import.' }, 'That did not work', 'You cannot import.'],
    ['not-found', { message: 'No such match.' }, 'That did not work', 'No such match.'],
  ])('maps %s to its title and message', (kind, extra, title, text) => {
    render(<ImportProblemAlert problem={problem({ kind, ...extra })} input="file" />)
    expect(alertText()).toHaveTextContent(title)
    expect(alertText()).toHaveTextContent(text)
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('says the file is still chosen for a file input', () => {
    render(<ImportProblemAlert problem={problem({ kind: 'too-large', message: 'Too big.' })} input="file" />)
    expect(alertText()).toHaveTextContent('Your file is still chosen.')
  })

  it.each([['network', "We couldn't reach the server"], ['other', 'That did not work']] as const)('offers Try again for %s', async (kind, title) => {
    const onRetry = vi.fn()
    render(<ImportProblemAlert problem={problem({ kind })} onRetry={onRetry} />)
    expect(alertText()).toHaveTextContent(title)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('disables the retry while retrying', () => {
    render(<ImportProblemAlert problem={problem({ kind: 'network' })} onRetry={vi.fn()} retrying />)
    expect(screen.getByRole('button', { name: 'Trying again…' })).toBeDisabled()
  })
})
