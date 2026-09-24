import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import { RecordDetailScreen, DetailFieldRow, DetailFieldGrid } from './RecordDetailScreen'
import { baseTheme } from '../../theme'

describe('RecordDetailScreen', () => {
  it('renders the Back action, header (avatar/title/badge), sections in order, and the Edit action', () => {
    render(
      <MemoryRouter initialEntries={['/manage/players/p-1']}>
        <Routes>
          <Route
            path="/manage/players/p-1"
            element={
              <RecordDetailScreen
                title="Jane Smith"
                backTo="/manage/players"
                backLabel="Back to Players"
                avatar={{ fallback: 'JA', shape: 'circular' }}
                badge={{ label: 'Active', tone: 'positive' }}
                editTo="/manage/players/p-1/edit"
                sections={[
                  { heading: 'Basic Info', content: <div>Basic Info content</div> },
                  { heading: 'Contact Info', content: <div>Contact Info content</div> },
                ]}
              />
            }
          />
          <Route path="/manage/players" element={<div>Player List Page</div>} />
          <Route path="/manage/players/p-1/edit" element={<div>Edit Player Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /back to players/i })).toHaveAttribute('href', '/manage/players')
    expect(screen.getByRole('heading', { name: 'Jane Smith' })).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(document.querySelector('.MuiAvatar-root')).toHaveTextContent('JA')

    const headings = screen.getAllByText(/basic info|contact info/i).map((node) => node.textContent)
    expect(headings.indexOf('Basic Info')).toBeLessThan(headings.indexOf('Contact Info'))
    expect(screen.getByText('Basic Info content')).toBeInTheDocument()
    expect(screen.getByText('Contact Info content')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute('href', '/manage/players/p-1/edit')
  })

  it('omits the section heading entirely for a single, un-headed section', () => {
    render(
      <MemoryRouter initialEntries={['/manage/fixtures/seasons/s-1']}>
        <Routes>
          <Route
            path="/manage/fixtures/seasons/s-1"
            element={
              <RecordDetailScreen
                title="2026 Season"
                backTo="/manage/fixtures/seasons"
                backLabel="Back to Seasons"
                editTo="/manage/fixtures/seasons/s-1/edit"
                sections={[{ content: <div>Season fields</div> }]}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Season fields')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 6, name: /details/i })).not.toBeInTheDocument()
  })

  it('renders a note above a section\'s content when provided', () => {
    render(
      <MemoryRouter initialEntries={['/manage/teams/t-1']}>
        <Routes>
          <Route
            path="/manage/teams/t-1"
            element={
              <RecordDetailScreen
                title="1st XI"
                backTo="/manage/teams"
                backLabel="Back to Teams"
                editTo="/manage/teams/t-1/edit"
                sections={[{ heading: 'Squad', note: <div>12 players</div>, content: <div>Squad cards</div> }]}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('12 players')).toBeInTheDocument()
    expect(screen.getByText('Squad cards')).toBeInTheDocument()
  })

  it('renders without an avatar or badge when neither is provided', () => {
    render(
      <MemoryRouter initialEntries={['/manage/club-contacts/c-1']}>
        <Routes>
          <Route
            path="/manage/club-contacts/c-1"
            element={
              <RecordDetailScreen
                title="Jane Smith"
                backTo="/manage/club-contacts"
                backLabel="Back to Contacts"
                editTo="/manage/club-contacts/c-1/edit"
                sections={[{ content: <div>Contact fields</div> }]}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(document.querySelector('.MuiAvatar-root')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jane Smith' })).toBeInTheDocument()
  })

  // docs/specs/037-match-improvements.md item 2
  it('renders secondaryActions before the Edit action, and omits them entirely when not passed', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/manage/fixtures/matches/m-1']}>
        <Routes>
          <Route
            path="/manage/fixtures/matches/m-1"
            element={
              <RecordDetailScreen
                title="1st XI vs 2nd XI"
                backTo="/manage/fixtures/matches"
                backLabel="Back to Matches"
                editTo="/manage/fixtures/matches/m-1/edit"
                secondaryActions={[{ label: 'Select Team', to: '/manage/fixtures/matches/m-1/edit?tab=playing-xi' }]}
                sections={[{ content: <div>Match fields</div> }]}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    const buttons = screen.getAllByRole('link')
    const labels = buttons.map((button) => button.textContent)
    expect(labels.indexOf('Select Team')).toBeGreaterThanOrEqual(0)
    expect(labels.indexOf('Select Team')).toBeLessThan(labels.indexOf('Edit'))
    expect(screen.getByRole('link', { name: 'Select Team' })).toHaveAttribute(
      'href',
      '/manage/fixtures/matches/m-1/edit?tab=playing-xi',
    )

    rerender(
      <MemoryRouter initialEntries={['/manage/fixtures/matches/m-1']}>
        <Routes>
          <Route
            path="/manage/fixtures/matches/m-1"
            element={
              <RecordDetailScreen
                title="1st XI vs 2nd XI"
                backTo="/manage/fixtures/matches"
                backLabel="Back to Matches"
                editTo="/manage/fixtures/matches/m-1/edit"
                sections={[{ content: <div>Match fields</div> }]}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('link', { name: 'Select Team' })).not.toBeInTheDocument()
  })

  // docs/specs/046-header-body-elevation-standard.md
  it('renders the header content (Back link/title/badge/Edit) inside a PageHeaderBand', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <MemoryRouter initialEntries={['/manage/players/p-1']}>
          <Routes>
            <Route
              path="/manage/players/p-1"
              element={
                <RecordDetailScreen
                  title="Jane Smith"
                  backTo="/manage/players"
                  backLabel="Back to Players"
                  avatar={{ fallback: 'JA', shape: 'circular' }}
                  badge={{ label: 'Active', tone: 'positive' }}
                  editTo="/manage/players/p-1/edit"
                  sections={[{ content: <div>Basic Info content</div> }]}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    // PageHeaderBand renders a single Box wrapping the Back link + title/badge/Edit Stack
    // directly — the Back link's own DOM parent is that Box, so this asserts the header content is
    // an immediate child of an element carrying PageHeaderBand's own distinguishing treatment
    // (flat white background, 3px solid primary.main top accent), rather than just re-rendering.
    const backLink = screen.getByRole('link', { name: /back to players/i })
    const editLink = screen.getByRole('link', { name: /edit/i })
    const band = backLink.parentElement as HTMLElement

    expect(band.contains(editLink)).toBe(true)
    expect(band).toHaveStyle({
      backgroundColor: 'rgb(255, 255, 255)',
      borderTopWidth: '3px',
      borderTopStyle: 'solid',
      borderTopColor: 'rgb(47, 110, 79)', // baseTheme.palette.primary.main
    })
  })

  // docs/specs/046-header-body-elevation-standard.md
  it('renders each section inside its own, distinct ContentCard surface', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <MemoryRouter initialEntries={['/manage/players/p-1']}>
          <Routes>
            <Route
              path="/manage/players/p-1"
              element={
                <RecordDetailScreen
                  title="Jane Smith"
                  backTo="/manage/players"
                  backLabel="Back to Players"
                  editTo="/manage/players/p-1/edit"
                  sections={[
                    { heading: 'Basic Info', content: <div>Basic Info content</div> },
                    { heading: 'Contact Info', content: <div>Contact Info content</div> },
                  ]}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    // ContentCard renders a single Box wrapping a section's heading/note/content directly — each
    // section's content text's own DOM parent is that section's own ContentCard.
    const card1 = screen.getByText('Basic Info content').parentElement as HTMLElement
    const card2 = screen.getByText('Contact Info content').parentElement as HTMLElement

    expect(card1).not.toBe(card2) // two distinct card surfaces, one per section
    for (const card of [card1, card2]) {
      expect(card).toHaveStyle({ backgroundColor: 'rgb(255, 255, 255)' })
      expect(getComputedStyle(card).boxShadow).not.toBe('')
    }
  })

  // docs/specs/046-header-body-elevation-standard.md
  it("renders the title at fontWeight 700", () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <MemoryRouter initialEntries={['/manage/players/p-1']}>
          <Routes>
            <Route
              path="/manage/players/p-1"
              element={
                <RecordDetailScreen
                  title="Jane Smith"
                  backTo="/manage/players"
                  backLabel="Back to Players"
                  editTo="/manage/players/p-1/edit"
                  sections={[{ content: <div>Basic Info content</div> }]}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Jane Smith' })).toHaveStyle({ fontWeight: '700' })
  })

  it('renders headerNote directly under the header when provided, and omits it entirely otherwise', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/manage/players/p-1']}>
        <Routes>
          <Route
            path="/manage/players/p-1"
            element={
              <RecordDetailScreen
                title="Jane Smith"
                backTo="/manage/players"
                backLabel="Back to Players"
                editTo="/manage/players/p-1/edit"
                headerNote={<div>Season picker</div>}
                sections={[{ heading: 'Basic Info', content: <div>Basic Info content</div> }]}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Season picker')).toBeInTheDocument()

    rerender(
      <MemoryRouter initialEntries={['/manage/players/p-1']}>
        <Routes>
          <Route
            path="/manage/players/p-1"
            element={
              <RecordDetailScreen
                title="Jane Smith"
                backTo="/manage/players"
                backLabel="Back to Players"
                editTo="/manage/players/p-1/edit"
                sections={[{ heading: 'Basic Info', content: <div>Basic Info content</div> }]}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByText('Season picker')).not.toBeInTheDocument()
  })
})

describe('DetailFieldRow', () => {
  it('renders the icon, label, and value', () => {
    render(<DetailFieldRow icon={<EmailOutlinedIcon data-testid="email-icon" />} label="Email" value="jane@example.com" />)

    expect(screen.getByTestId('email-icon')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
  })
})

describe('DetailFieldGrid', () => {
  it('renders its children', () => {
    render(
      <DetailFieldGrid>
        <div>Field one</div>
        <div>Field two</div>
      </DetailFieldGrid>,
    )

    expect(screen.getByText('Field one')).toBeInTheDocument()
    expect(screen.getByText('Field two')).toBeInTheDocument()
  })
})
