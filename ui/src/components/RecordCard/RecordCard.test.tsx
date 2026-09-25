import { TextField } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RecordCard } from './RecordCard'
import { baseTheme } from '../../theme'

describe('RecordCard', () => {
  it('renders title, badge, description, fields, and chips in slot order', () => {
    render(
      <RecordCard
        title="Club Standard"
        badge={{ label: 'Active', tone: 'positive' }}
        description="Everything a growing club needs."
        fields={[
          { label: 'Price', value: 'USD 49.99/month' },
          { label: 'Code', value: 'CLUB_STANDARD' },
        ]}
        chips={['5 sections', '10 teams', '200 players']}
        editLabel="Edit"
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Club Standard' })).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Everything a growing club needs.')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('USD 49.99/month')).toBeInTheDocument()
    expect(screen.getByText('Code')).toBeInTheDocument()
    expect(screen.getByText('CLUB_STANDARD')).toBeInTheDocument()
    expect(screen.getByText('5 sections')).toBeInTheDocument()
    expect(screen.getByText('10 teams')).toBeInTheDocument()
    expect(screen.getByText('200 players')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('omits optional slots when not provided', () => {
    render(<RecordCard title="Free" editLabel="Edit" onEdit={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /active|retired|draft/i })).not.toBeInTheDocument()
  })

  it('calls onEdit when the Edit action is clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<RecordCard title="Club Standard" editLabel="Edit" onEdit={onEdit} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('renders the muted badge tone distinctly from the neutral tone', () => {
    const { unmount } = render(
      <RecordCard title="Neutral Product" badge={{ label: 'Draft', tone: 'neutral' }} editLabel="Edit" onEdit={vi.fn()} />,
    )
    const neutralChip = screen.getByText('Draft').closest('.MuiChip-root')
    expect(neutralChip).toHaveClass('MuiChip-outlined')
    unmount()

    render(<RecordCard title="Muted Product" badge={{ label: 'Retired', tone: 'muted' }} editLabel="Edit" onEdit={vi.fn()} />)
    const mutedChip = screen.getByText('Retired').closest('.MuiChip-root')
    expect(mutedChip).toHaveClass('MuiChip-filled')
    expect(mutedChip).not.toHaveClass('MuiChip-outlined')
  })

  it('renders the Edit action as a router link when editTo is provided', () => {
    render(
      <MemoryRouter initialEntries={['/products']}>
        <Routes>
          <Route
            path="/products"
            element={<RecordCard title="Club Standard" editLabel="Edit" editTo="/products/p-1/edit" />}
          />
          <Route path="/products/:id/edit" element={<div>Edit Product Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/products/p-1/edit')
  })

  // docs/specs/019-resend-subscription-welcome-email.md — secondaryAction/feedback are generic,
  // optional RecordCard props; ProductList.tsx's existing usage passes neither, so this coverage
  // must not disturb any test above.
  it('renders and calls onClick for secondaryAction, alongside the existing Edit action', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <RecordCard
        title="Riverside CC"
        editLabel="Edit"
        onEdit={vi.fn()}
        secondaryAction={{ label: 'Resend welcome email', pendingLabel: 'Sending…', pending: false, onClick }}
      />,
    )

    const button = screen.getByRole('button', { name: 'Resend welcome email' })
    expect(button).not.toBeDisabled()
    await user.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('shows pendingLabel and disables the button while secondaryAction.pending is true', () => {
    render(
      <RecordCard
        title="Riverside CC"
        editLabel="Edit"
        onEdit={vi.fn()}
        secondaryAction={{ label: 'Resend welcome email', pendingLabel: 'Sending…', pending: true, onClick: vi.fn() }}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Resend welcome email' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled()
  })

  it('renders feedback message in success.main for a success tone', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <RecordCard
          title="Riverside CC"
          editLabel="Edit"
          onEdit={vi.fn()}
          feedback={{ message: 'Welcome email resent to jaco@example.com.', tone: 'success' }}
        />
      </ThemeProvider>,
    )

    const outcome = screen.getByText('Welcome email resent to jaco@example.com.')
    expect(outcome).toHaveStyle({ color: 'rgb(14, 124, 102)' }) // theme.ts's success.main (#0e7c66)
  })

  it('renders feedback message in error.main for an error tone', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <RecordCard
          title="Riverside CC"
          editLabel="Edit"
          onEdit={vi.fn()}
          feedback={{ message: 'Failed to resend welcome email: Connection refused', tone: 'error' }}
        />
      </ThemeProvider>,
    )

    const outcome = screen.getByText('Failed to resend welcome email: Connection refused')
    expect(outcome).toHaveStyle({ color: 'rgb(176, 64, 46)' }) // theme.ts's error.main (#b0402e)
  })

  it('renders neither secondaryAction nor feedback when both are omitted, matching ProductList.tsx\'s existing usage', () => {
    render(<RecordCard title="Club Standard" editLabel="Edit" onEdit={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /resend/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/welcome email/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('omits the avatar entirely when not provided', () => {
    render(<RecordCard title="Club Standard" editLabel="Edit" onEdit={vi.fn()} />)

    expect(document.querySelector('.MuiAvatar-root')).not.toBeInTheDocument()
  })

  it('renders the fallback initials when no imageUrl is given', () => {
    render(
      <RecordCard
        title="Jane Smith"
        avatar={{ fallback: 'JA', shape: 'circular' }}
        editLabel="Edit"
        onEdit={vi.fn()}
      />,
    )

    const avatar = document.querySelector('.MuiAvatar-root')
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveClass('MuiAvatar-circular')
    expect(avatar).toHaveTextContent('JA')
  })

  it('renders a rounded avatar with an image src when imageUrl is given', () => {
    render(
      <RecordCard
        title="Riverside 1st XI"
        avatar={{ imageUrl: 'https://example.com/logo.png', fallback: 'R1', shape: 'rounded' }}
        editLabel="Edit"
        onEdit={vi.fn()}
      />,
    )

    const avatar = document.querySelector('.MuiAvatar-root')
    expect(avatar).toHaveClass('MuiAvatar-rounded')
    const img = avatar?.querySelector('img')
    expect(img).toHaveAttribute('src', 'https://example.com/logo.png')
  })

  // docs/specs/030-team-sheet-communication.md — secondaryActions is an ordered-list generalization
  // of the existing single secondaryAction slot, additive and rendered alongside it.
  it('renders every secondaryActions entry in order, alongside an existing secondaryAction', () => {
    render(
      <RecordCard
        title="Riverside vs Coastal"
        editLabel="Edit"
        onEdit={vi.fn()}
        secondaryAction={{ label: 'Deactivate', pendingLabel: 'Deactivating…', pending: false, onClick: vi.fn() }}
        secondaryActions={[
          { label: 'Communicate Team Sheet', pendingLabel: 'Opening…', pending: false, onClick: vi.fn() },
          { label: 'Duplicate Match', pendingLabel: 'Duplicating…', pending: false, onClick: vi.fn() },
        ]}
      />,
    )

    const buttons = screen.getAllByRole('button').map((button) => button.textContent)
    const deactivateIndex = buttons.findIndex((text) => text === 'Deactivate')
    const communicateIndex = buttons.findIndex((text) => text === 'Communicate Team Sheet')
    const duplicateIndex = buttons.findIndex((text) => text === 'Duplicate Match')
    const editIndex = buttons.findIndex((text) => text === 'Edit')

    expect(deactivateIndex).toBeGreaterThanOrEqual(0)
    expect(communicateIndex).toBeGreaterThan(deactivateIndex)
    expect(duplicateIndex).toBeGreaterThan(communicateIndex)
    expect(editIndex).toBeGreaterThan(duplicateIndex)
  })

  it('renders secondaryActions correctly with no secondaryAction passed at all', () => {
    render(
      <RecordCard
        title="Riverside vs Coastal"
        editLabel="Edit"
        onEdit={vi.fn()}
        secondaryActions={[
          { label: 'Communicate Team Sheet', pendingLabel: 'Opening…', pending: false, onClick: vi.fn() },
        ]}
      />,
    )

    expect(screen.getByRole('button', { name: 'Communicate Team Sheet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
  })

  it('renders startIcon elements on the Edit and secondaryAction buttons', () => {
    render(
      <RecordCard
        title="Riverside CC"
        editLabel="Edit"
        onEdit={vi.fn()}
        secondaryAction={{
          label: 'Deactivate',
          pendingLabel: 'Deactivating…',
          pending: false,
          onClick: vi.fn(),
          icon: <span data-testid="deactivate-icon" />,
        }}
      />,
    )

    const editButton = screen.getByRole('button', { name: 'Edit' })
    expect(editButton.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByTestId('deactivate-icon')).toBeInTheDocument()
  })

  // docs/specs/059-record-card-click-to-view.md: the dedicated footer "View" button is gone —
  // the card's title itself becomes the (stretched-link) navigation to viewTo. When editTo is ALSO
  // passed, Edit still renders alongside it in the footer.
  it('renders the title as a link to viewTo, with Edit alongside it, when both viewTo and editTo are provided', () => {
    render(
      <MemoryRouter initialEntries={['/manage/players']}>
        <Routes>
          <Route
            path="/manage/players"
            element={
              <RecordCard
                title="Jane Smith"
                editLabel="Edit"
                editTo="/manage/players/p-1/edit"
                viewTo="/manage/players/p-1"
              />
            }
          />
          <Route path="/manage/players/p-1" element={<div>Player Detail Page</div>} />
          <Route path="/manage/players/p-1/edit" element={<div>Player Edit Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Jane Smith' })).toHaveAttribute('href', '/manage/players/p-1')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/players/p-1/edit')
    expect(screen.queryByRole('link', { name: 'View' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument()
  })

  it('renders the title as a link to viewTo, with no Edit action at all, when only viewTo is provided', () => {
    render(
      <MemoryRouter initialEntries={['/manage/players']}>
        <Routes>
          <Route
            path="/manage/players"
            element={<RecordCard title="Jane Smith" editLabel="Edit" viewTo="/manage/players/p-1" />}
          />
          <Route path="/manage/players/p-1" element={<div>Player Detail Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Jane Smith' })).toHaveAttribute('href', '/manage/players/p-1')
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  // jsdom has no layout/hit-testing engine, so a synthetic click fired on a DOM element that is a
  // *sibling* of the title link (e.g. the description text) never bubbles to the link the way a
  // real browser's click-through-the-::after-overlay does — the whole point of the stretched-link
  // technique only manifests via real paint/stacking, which is exactly why the spec's own Test Plan
  // also calls for an End-to-end (Playwright, real browser) check of this same scenario. What IS
  // reliably provable at this tier: (1) the title renders as a real link whose click fires
  // navigation (below, and via the href assertions above), and (2) the CSS that makes that link's
  // click target cover the whole card — MuiCard's `position: relative` containing block and the
  // link's own `::after` overlay (the link itself deliberately stays `position: static` — see the
  // spec's own corrected UI Requirements) — is actually wired up on the rendered elements, not
  // just present in source.
  it('clicking the title (the card-wide stretched link) navigates to viewTo', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/manage/players']}>
        <Routes>
          <Route
            path="/manage/players"
            element={
              <RecordCard
                title="Jane Smith"
                editLabel="Edit"
                editTo="/manage/players/p-1/edit"
                viewTo="/manage/players/p-1"
                description="Opening batter."
              />
            }
          />
          <Route path="/manage/players/p-1" element={<div>Player Detail Page</div>} />
          <Route path="/manage/players/p-1/edit" element={<div>Player Edit Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('link', { name: 'Jane Smith' }))

    expect(screen.getByText('Player Detail Page')).toBeInTheDocument()
  })

  it('wires the stretched-link CSS (MuiCard containing block + title link overlay) that makes the whole card clickable', () => {
    render(
      <MemoryRouter initialEntries={['/manage/players']}>
        <Routes>
          <Route
            path="/manage/players"
            element={<RecordCard title="Jane Smith" viewTo="/manage/players/p-1" editTo="/manage/players/p-1/edit" />}
          />
        </Routes>
      </MemoryRouter>,
    )

    const titleLink = screen.getByRole('link', { name: 'Jane Smith' })
    // The link itself is deliberately left position: static (the default, i.e. absent from its
    // inline/class styles) — giving it its own position: relative would make IT the containing
    // block for its own ::after (a pseudo-element's containing-block search starts at its own
    // originating element), constraining the overlay to the link's own tiny box instead of letting
    // the search skip past it to MuiCard. Verified empirically in a real browser.
    expect(titleLink).not.toHaveStyle({ position: 'relative' })
    // MuiCard is the .MuiCard-root ancestor — the containing block the link's ::after resolves
    // `inset: 0` against, per docs/specs/059-record-card-click-to-view.md.
    expect(titleLink.closest('.MuiCard-root')).toHaveStyle({ position: 'relative' })
    // CardActions must also be positioned, or the ::after overlay paints above the Edit/secondary
    // action buttons inside it and silently swallows their clicks (the stacking-order fix).
    expect(document.querySelector('.MuiCardActions-root')).toHaveStyle({ position: 'relative' })
  })

  it('navigates to editTo (not viewTo) when Edit is clicked on a card with both', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/manage/players']}>
        <Routes>
          <Route
            path="/manage/players"
            element={
              <RecordCard
                title="Jane Smith"
                editLabel="Edit"
                editTo="/manage/players/p-1/edit"
                viewTo="/manage/players/p-1"
              />
            }
          />
          <Route path="/manage/players/p-1" element={<div>Player Detail Page</div>} />
          <Route path="/manage/players/p-1/edit" element={<div>Player Edit Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('link', { name: 'Edit' }))

    expect(screen.getByText('Player Edit Page')).toBeInTheDocument()
    expect(screen.queryByText('Player Detail Page')).not.toBeInTheDocument()
  })

  it('fires secondaryAction.onClick without navigating when viewTo is also set', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <MemoryRouter initialEntries={['/manage/players']}>
        <Routes>
          <Route
            path="/manage/players"
            element={
              <RecordCard
                title="Jane Smith"
                viewTo="/manage/players/p-1"
                secondaryAction={{ label: 'Deactivate', pendingLabel: 'Deactivating…', pending: false, onClick }}
              />
            }
          />
          <Route path="/manage/players/p-1" element={<div>Player Detail Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Player Detail Page')).not.toBeInTheDocument()
  })

  it('renders no card-wide link at all when viewTo is not provided', () => {
    render(<RecordCard title="Jane Smith" editLabel="Edit" onEdit={vi.fn()} />)

    expect(screen.queryByRole('link', { name: 'Jane Smith' })).not.toBeInTheDocument()
  })

  // Existing editTo/onEdit-only call sites (anything not touched by 036) are unaffected — purely
  // additive, per the plan.
  it('keeps rendering the Edit action normally when viewTo is not provided', () => {
    render(
      <MemoryRouter initialEntries={['/products']}>
        <Routes>
          <Route
            path="/products"
            element={<RecordCard title="Club Standard" editLabel="Edit" editTo="/products/p-1/edit" />}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/products/p-1/edit')
    expect(screen.queryByRole('link', { name: 'View' })).not.toBeInTheDocument()
  })

  // docs/specs/040-announce-team.md: `badges` is an array slot coexisting with the singular
  // `badge`, rendered in the same top-right Stack.
  it('renders every badges entry alongside an existing badge', () => {
    render(
      <RecordCard
        title="Riverside 1st XI vs Coastal CC"
        badge={{ label: 'Inactive', tone: 'muted' }}
        badges={[
          { label: 'Riverside 1st XI: Announced', tone: 'positive' },
          { label: 'Coastal CC: Not Announced', tone: 'neutral' },
        ]}
        editLabel="Edit"
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByText('Riverside 1st XI: Announced')).toBeInTheDocument()
    expect(screen.getByText('Coastal CC: Not Announced')).toBeInTheDocument()
  })

  it('renders badges entries on their own, with no badge prop passed', () => {
    render(
      <RecordCard
        title="Riverside 1st XI vs Coastal CC"
        badges={[{ label: 'Announced', tone: 'positive' }]}
        editLabel="Edit"
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByText('Announced')).toBeInTheDocument()
  })

  // Regression coverage (docs/specs/031-jersey-numbers.md): a field's `value` can be a real form
  // control, not just static text — TeamFormPage's inline "Squad #" edit passes an MUI Input.
  // The value slot used to render inside a Typography variant="body2" with no `component`
  // override, which defaults to a <p> — invalid HTML once that value is a form control (Input
  // renders a <fieldset> for its outline), and a live React hydration console error caught during
  // manual testing. Asserts the container is not a <p> so this can't silently regress.
  it('does not nest a form-control field value inside a <p>', () => {
    render(
      <RecordCard
        title="Riverside CC"
        editLabel="Edit"
        onEdit={vi.fn()}
        fields={[{ label: 'Squad #', value: <TextField size="small" label="" aria-label="squad number" /> }]}
      />,
    )

    const input = screen.getByLabelText('squad number')
    expect(input.closest('p')).toBeNull()
  })
})
