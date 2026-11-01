import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ScheduleFindingsPanel } from './ScheduleFindingsPanel'
import type { ScheduleFindings } from '../../api/matchApi'

const renderPanel = (result: ScheduleFindings, extra: Partial<Parameters<typeof ScheduleFindingsPanel>[0]> = {}) =>
  render(
    <MemoryRouter initialEntries={['/manage/fixtures/matches/new']}>
      <ScheduleFindingsPanel result={result} {...extra} />
    </MemoryRouter>,
  )

describe('ScheduleFindingsPanel', () => {
  it('shows an error with an Open link carrying returnTo and no Save Anyway', () => {
    renderPanel({
      needsConfirmation: false,
      findings: [{ code: 'DUPLICATE_MATCH', severity: 'ERROR', message: 'Already scheduled', otherMatchId: 'm9' }],
    })
    expect(screen.getByText('Already scheduled')).toBeInTheDocument()
    const href = screen.getByRole('link', { name: 'Open' }).getAttribute('href') as string
    expect(href).toContain('/manage/fixtures/matches/m9')
    expect(href).toContain('returnTo=%2Fmanage%2Ffixtures%2Fmatches%2Fnew')
    expect(screen.queryByRole('button', { name: 'Save Anyway' })).not.toBeInTheDocument()
  })

  it('offers Save Anyway and Cancel for warnings only', async () => {
    const user = userEvent.setup()
    const onSaveAnyway = vi.fn()
    const onCancel = vi.fn()
    renderPanel(
      { needsConfirmation: true, findings: [{ code: 'DUPLICATE_SAME_DAY', severity: 'WARNING', message: 'Same day' }] },
      { onSaveAnyway, onCancel },
    )
    await user.click(screen.getByRole('button', { name: 'Save Anyway' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onSaveAnyway).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('hides Save Anyway when an error is mixed in', () => {
    renderPanel({
      needsConfirmation: false,
      findings: [
        { code: 'OWN_TEAM_OVERLAP', severity: 'ERROR', message: 'Overlap' },
        { code: 'DUPLICATE_SAME_DAY', severity: 'WARNING', message: 'Same day' },
      ],
    })
    expect(screen.getByText('Overlap')).toBeInTheDocument()
    expect(screen.getByText('Same day')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save Anyway' })).not.toBeInTheDocument()
  })
})
