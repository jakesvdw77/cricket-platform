import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { installFakeImportApi } from '../../../components/ImportWizard/importFakes'
import type { FakeImportServer } from '../../../components/ImportWizard/importFakes'
import { sampleBatch } from '../../../components/ImportWizard/importFixtures'
import { ImportScheduleButton } from './ImportScheduleControls'

let server: FakeImportServer | null = null
afterEach(() => server?.restore())

function Where() {
  const location = useLocation()
  return <div data-testid="where">{location.pathname + location.search}</div>
}

function renderControls(ui: React.ReactNode, entry = '/') {
  server = installFakeImportApi({ history: [sampleBatch({ status: 'COMMITTED' })] })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="*" element={<>{ui}<Where /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ImportScheduleButton', () => {
  it('opens the wizard for the league and season, remembering the originating view', () => {
    renderControls(<ImportScheduleButton leagueId="l1" seasonId="s1" from="view" />)
    fireEvent.click(screen.getByRole('button', { name: 'Import Schedule' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/manage/fixtures/leagues/l1/schedule/import?seasonId=s1&from=view')
  })

  // docs/specs/127-return-navigation.md
  it('passes the page it is on as returnTo, with the label', () => {
    renderControls(<ImportScheduleButton leagueId="l1" seasonId="s1" from="view" originLabel="TVL schedule" />, '/manage/fixtures/leagues/l1/schedule?seasonId=s1')
    fireEvent.click(screen.getByRole('button', { name: 'Import Schedule' }))
    const where = screen.getByTestId('where').textContent ?? ''
    expect(where.startsWith('/manage/fixtures/leagues/l1/schedule/import?seasonId=s1&from=view')).toBe(true)
    const params = new URLSearchParams(where.split('?')[1])
    expect(params.get('returnTo')).toBe('/manage/fixtures/leagues/l1/schedule?seasonId=s1')
    expect(params.get('returnLabel')).toBe('TVL schedule')
  })

  it('is disabled with no season, and when the league is inactive', () => {
    renderControls(
      <>
        <ImportScheduleButton leagueId="l1" seasonId="" from="edit" />
        <ImportScheduleButton leagueId="l1" seasonId="s1" leagueActive={false} from="edit" />
      </>,
    )
    for (const button of screen.getAllByRole('button', { name: 'Import Schedule' })) expect(button).toBeDisabled()
  })
})
