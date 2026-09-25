import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import { RecordQuickViewDialog } from './RecordQuickViewDialog'

const fields = [
  { icon: <EmailOutlinedIcon data-testid="email-icon" />, label: 'Email', value: 'jane@example.com' },
  { icon: <PhoneOutlinedIcon data-testid="phone-icon" />, label: 'Phone', value: '+27 82 555 0101' },
]

describe('RecordQuickViewDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <MemoryRouter>
        <RecordQuickViewDialog
          open={false}
          onClose={vi.fn()}
          avatar={{ fallback: 'JA', shape: 'circular' }}
          title="Jane Smith"
          fields={fields}
          editTo="/manage/club-contacts/c-1/edit"
        />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
  })

  it('renders the avatar fallback, title, subtitle, and every field when open', () => {
    render(
      <MemoryRouter>
        <RecordQuickViewDialog
          open
          onClose={vi.fn()}
          avatar={{ fallback: 'JA', shape: 'circular' }}
          title="Jane Smith"
          subtitle="Club Secretary"
          fields={fields}
          editTo="/manage/club-contacts/c-1/edit"
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Jane Smith' })).toBeInTheDocument()
    expect(screen.getByText('Club Secretary')).toBeInTheDocument()
    expect(document.querySelector('.MuiAvatar-root')).toHaveTextContent('JA')
    expect(screen.getByTestId('email-icon')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByTestId('phone-icon')).toBeInTheDocument()
    expect(screen.getByText('Phone')).toBeInTheDocument()
    expect(screen.getByText('+27 82 555 0101')).toBeInTheDocument()
  })

  it('renders the avatar image when imageUrl is set, instead of the fallback', () => {
    render(
      <MemoryRouter>
        <RecordQuickViewDialog
          open
          onClose={vi.fn()}
          avatar={{ imageUrl: 'https://example.com/photo.png', fallback: 'JA', shape: 'circular' }}
          title="Jane Smith"
          fields={fields}
          editTo="/manage/club-contacts/c-1/edit"
        />
      </MemoryRouter>,
    )

    const avatar = document.querySelector('.MuiAvatar-root')
    expect(avatar?.querySelector('img')).toHaveAttribute('src', 'https://example.com/photo.png')
  })

  it('omits the subtitle line entirely when not provided', () => {
    render(
      <MemoryRouter>
        <RecordQuickViewDialog
          open
          onClose={vi.fn()}
          avatar={{ fallback: 'JA', shape: 'circular' }}
          title="Jane Smith"
          fields={fields}
          editTo="/manage/club-contacts/c-1/edit"
        />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Club Secretary')).not.toBeInTheDocument()
  })

  it('renders the Edit button as a link targeting editTo, defaulting its label to "Edit"', () => {
    render(
      <MemoryRouter>
        <RecordQuickViewDialog
          open
          onClose={vi.fn()}
          avatar={{ fallback: 'JA', shape: 'circular' }}
          title="Jane Smith"
          fields={fields}
          editTo="/manage/club-contacts/c-1/edit"
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/club-contacts/c-1/edit')
  })

  it('renders a custom editLabel when provided', () => {
    render(
      <MemoryRouter>
        <RecordQuickViewDialog
          open
          onClose={vi.fn()}
          avatar={{ fallback: 'AC', shape: 'rounded' }}
          title="Acme Cricket Gear"
          fields={fields}
          editTo="/manage/sponsors/s-1/edit"
          editLabel="Edit sponsor"
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Edit sponsor' })).toHaveAttribute('href', '/manage/sponsors/s-1/edit')
  })

  it('calls onClose when the Close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <RecordQuickViewDialog
          open
          onClose={onClose}
          avatar={{ fallback: 'JA', shape: 'circular' }}
          title="Jane Smith"
          fields={fields}
          editTo="/manage/club-contacts/c-1/edit"
        />
      </MemoryRouter>,
    )

    screen.getByRole('button', { name: 'Close' }).click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
