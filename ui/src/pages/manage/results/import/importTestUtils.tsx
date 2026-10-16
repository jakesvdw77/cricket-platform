import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { baseTheme } from '../../../../theme'
import type { ImportAdaptor, ImportCatalogue, ImportNote, ImportPreview, ImportResolved, MatchCandidate } from '../../../../api/resultImportApi'
import ResultImportPage from './ResultImportPage'

// Shared fixtures and the render helper for the 104 import wizard tests (not production code). Every name is invented.

export const jsonAdaptor: ImportAdaptor = {
  type: 'CRICKET_LEGEND_JSON',
  displayName: 'Cricket Legend JSON',
  description: 'The platform common format, as a file or pasted text.',
  inputs: [{ format: 'JSON', textBased: true, extensions: ['.json'], maxBytes: 1024 * 1024, acceptsPaste: true }],
  aiAllowed: false,
  example: '{"schemaVersion":1}',
  conversionPrompt: 'Convert the attached scorecard to this JSON shape.',
}

// A binary source, as a PDF reader would be: upload only. Present only to prove the wizard knows no adaptor by name.
export const pdfAdaptor: ImportAdaptor = {
  type: 'SCOREBOOK_PDF',
  displayName: 'Scorebook PDF',
  description: 'A scorebook exported as a PDF.',
  inputs: [{ format: 'PDF', textBased: false, extensions: ['.pdf'], maxBytes: 5 * 1024 * 1024, acceptsPaste: false }],
  aiAllowed: false,
  example: null,
  conversionPrompt: null,
}

// A third source nobody coded for: a text format with two inputs (text and a file extension of its own).
export const fakeAdaptor: ImportAdaptor = {
  type: 'FAKE_SPREADSHEET',
  displayName: 'Fake Spreadsheet',
  description: 'A source added by a test with no UI change.',
  inputs: [
    { format: 'CSV', textBased: true, extensions: ['.csv'], maxBytes: 2048, acceptsPaste: true },
    { format: 'XLSX', textBased: false, extensions: ['.xlsx'], maxBytes: 4096, acceptsPaste: false },
  ],
  aiAllowed: false,
  example: null,
  conversionPrompt: null,
}

export const makeCatalogue = (adaptors: ImportAdaptor[] = [jsonAdaptor], maxPasteCharacters = 200): ImportCatalogue => ({
  adaptors,
  limits: { maxPasteCharacters, maxFileBytes: 1024 * 1024, maxPlayersPerSide: 15, maxRegularInnings: 2, maxNameLength: 100, maxReportedErrors: 50 },
})

export const makeCandidate = (overrides: Partial<MatchCandidate> = {}): MatchCandidate => ({
  matchId: 'match-1',
  label: 'Northgate Strollers v Riverside Occasionals',
  matchDate: new Date(2026, 9, 11, 13, 0).toISOString(),
  homeName: 'Northgate Strollers',
  homeIsClubTeam: true,
  awayIsClubTeam: true,
  awayName: 'Riverside Occasionals',
  leagueName: null,
  venue: 'Main Oval',
  reasons: ['DATE', 'TEAMS'],
  existingResult: null,
  // docs/specs/109: not deletable unless a test says so, so the row Delete never appears by accident.
  deletable: false,
  ...overrides,
})

export const makePreview = (overrides: Partial<ImportPreview> = {}): ImportPreview => ({
  document: {
    schemaVersion: 1,
    source: { adaptor: 'CRICKET_LEGEND_JSON', provider: 'ACMESCORE', externalMatchId: '4411' },
    match: { date: '2026-10-11', startTime: '13:00', venue: 'Main Oval' },
    teams: [
      { key: 'a', name: 'Northgate Strollers' },
      { key: 'b', name: 'Riverside Occasionals' },
    ],
    result: { outcome: 'WON', winner: 'a', margin: { type: 'RUNS', value: 24 } },
  },
  matchCandidates: [makeCandidate()],
  teamMapping: [
    { fileKey: 'a', fileName: 'Northgate Strollers', side: 'HOME', exactness: 'EXACT' },
    { fileKey: 'b', fileName: 'Riverside Occasionals', side: 'AWAY', exactness: 'NORMALISED', reason: 'Matched ignoring capitals.' },
  ],
  existingForExternalId: null,
  notes: [],
  ...overrides,
})

export const makeResolved = (overrides: Partial<ImportResolved> = {}): ImportResolved => ({
  matchId: 'match-1',
  resultStatus: 'DRAFT',
  exactness: {},
  counts: { exact: 9, normalised: 2, aiSuggested: 0, unresolved: 1 },
  notes: [],
  validation: { canPublish: true, errors: [], warnings: [], issues: [] },
  ...overrides,
})

export const nameNote = (fileText: string, overrides: Partial<ImportNote> = {}): ImportNote => ({
  code: 'NAME_SURNAME_PREFIX',
  severity: 'INFO',
  section: 'ours',
  message: 'Matched by the start of the surname.',
  fileText,
  ...overrides,
})

function Where() {
  const location = useLocation()
  return <div data-testid="where">{location.pathname + location.search}</div>
}

// The import wizard at /manage/results/import, with a probe route for where "Review" or Cancel navigates.
export function renderImportPage(search = '') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/manage/results/import${search}`]}>
          <Routes>
            <Route path="/manage" element={<Outlet context={{ clubId: 'club-1' }} />}>
              <Route path="results/import" element={<ResultImportPage />} />
              <Route path="*" element={<Where />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}
