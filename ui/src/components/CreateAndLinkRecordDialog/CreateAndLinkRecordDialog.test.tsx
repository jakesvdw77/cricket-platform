import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CreateAndLinkRecordDialog } from './CreateAndLinkRecordDialog'

const TEST_FORM_ID = 'test-form'

interface Payload {
  name: string
}

// A minimal stand-in for a real *Form component (ClubContactForm/SponsorForm) — a single Name
// field plus a <form> targeted by the dialog's outside confirm button via the native
// form="…" attribute, same wiring every real form in this codebase uses.
function TestForm({ onSubmit }: { onSubmit: (payload: Payload) => void }) {
  return (
    <form
      id={TEST_FORM_ID}
      onSubmit={(event) => {
        event.preventDefault()
        const name = (event.currentTarget.elements.namedItem('name') as HTMLInputElement).value
        onSubmit({ name })
      }}
    >
      <label htmlFor="name-field">Name</label>
      <input id="name-field" name="name" defaultValue="New Record" />
    </form>
  )
}

describe('CreateAndLinkRecordDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <CreateAndLinkRecordDialog<Payload>
        open={false}
        onClose={vi.fn()}
        title="New thing"
        formId={TEST_FORM_ID}
        renderForm={(onSubmit) => <TestForm onSubmit={onSubmit} />}
        onCreateAndLink={vi.fn()}
      />,
    )

    expect(screen.queryByText('New thing')).not.toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <CreateAndLinkRecordDialog<Payload>
        open
        onClose={onClose}
        title="New thing"
        formId={TEST_FORM_ID}
        renderForm={(onSubmit) => <TestForm onSubmit={onSubmit} />}
        onCreateAndLink={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('without an extraField', () => {
    it('submitting the wrapped form via the outside confirm button calls onCreateAndLink with just the payload', async () => {
      const user = userEvent.setup()
      const onCreateAndLink = vi.fn()
      render(
        <CreateAndLinkRecordDialog<Payload>
          open
          onClose={vi.fn()}
          title="New thing"
          formId={TEST_FORM_ID}
          renderForm={(onSubmit) => <TestForm onSubmit={onSubmit} />}
          onCreateAndLink={onCreateAndLink}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Create & link' }))

      expect(onCreateAndLink).toHaveBeenCalledWith({ name: 'New Record' })
    })

    it('shows the pending label and disables the confirm button while isPending', () => {
      render(
        <CreateAndLinkRecordDialog<Payload>
          open
          onClose={vi.fn()}
          title="New thing"
          formId={TEST_FORM_ID}
          renderForm={(onSubmit) => <TestForm onSubmit={onSubmit} />}
          onCreateAndLink={vi.fn()}
          isPending
        />,
      )

      expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled()
    })

    it('renders the error message when isError', () => {
      render(
        <CreateAndLinkRecordDialog<Payload>
          open
          onClose={vi.fn()}
          title="New thing"
          formId={TEST_FORM_ID}
          renderForm={(onSubmit) => <TestForm onSubmit={onSubmit} />}
          onCreateAndLink={vi.fn()}
          isError
          errorMessage="Couldn't create and link this record. Please try again."
        />,
      )

      expect(screen.getByText("Couldn't create and link this record. Please try again.")).toBeInTheDocument()
    })

    it('supports custom confirm/pending labels', () => {
      render(
        <CreateAndLinkRecordDialog<Payload>
          open
          onClose={vi.fn()}
          title="New thing"
          formId={TEST_FORM_ID}
          renderForm={(onSubmit) => <TestForm onSubmit={onSubmit} />}
          onCreateAndLink={vi.fn()}
          confirmLabel="Create & attach"
          pendingLabel="Attaching…"
        />,
      )

      expect(screen.getByRole('button', { name: 'Create & attach' })).toBeInTheDocument()
    })
  })

  describe('with an extraField', () => {
    it('disables the confirm button until the extra field is non-blank', async () => {
      const user = userEvent.setup()
      render(
        <CreateAndLinkRecordDialog<Payload>
          open
          onClose={vi.fn()}
          title="New thing"
          formId={TEST_FORM_ID}
          renderForm={(onSubmit) => <TestForm onSubmit={onSubmit} />}
          onCreateAndLink={vi.fn()}
          extraField={{ label: 'Role', quickFillOptions: ['Manager', 'Coach', 'Assistant Coach'] }}
        />,
      )

      expect(screen.getByRole('button', { name: 'Create & link' })).toBeDisabled()

      await user.type(screen.getByLabelText('Role'), 'Coach')

      expect(screen.getByRole('button', { name: 'Create & link' })).not.toBeDisabled()
    })

    it('a quick-fill option populates the extra field without submitting', async () => {
      const user = userEvent.setup()
      const onCreateAndLink = vi.fn()
      render(
        <CreateAndLinkRecordDialog<Payload>
          open
          onClose={vi.fn()}
          title="New thing"
          formId={TEST_FORM_ID}
          renderForm={(onSubmit) => <TestForm onSubmit={onSubmit} />}
          onCreateAndLink={onCreateAndLink}
          extraField={{ label: 'Role', quickFillOptions: ['Manager', 'Coach', 'Assistant Coach'] }}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Manager' }))

      expect(screen.getByLabelText('Role')).toHaveValue('Manager')
      expect(onCreateAndLink).not.toHaveBeenCalled()
    })

    it('submitting includes the trimmed extra value as a second argument', async () => {
      const user = userEvent.setup()
      const onCreateAndLink = vi.fn()
      render(
        <CreateAndLinkRecordDialog<Payload>
          open
          onClose={vi.fn()}
          title="New thing"
          formId={TEST_FORM_ID}
          renderForm={(onSubmit) => <TestForm onSubmit={onSubmit} />}
          onCreateAndLink={onCreateAndLink}
          extraField={{ label: 'Role' }}
        />,
      )

      await user.type(screen.getByLabelText('Role'), '  Coach  ')
      await user.click(screen.getByRole('button', { name: 'Create & link' }))

      expect(onCreateAndLink).toHaveBeenCalledWith({ name: 'New Record' }, 'Coach')
    })
  })
})
