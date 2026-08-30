import type { Meta, StoryObj } from '@storybook/react-vite'
import { CreateAndLinkRecordDialog } from './CreateAndLinkRecordDialog'

const TEST_FORM_ID = 'story-form'

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

const meta: Meta<typeof CreateAndLinkRecordDialog<Payload>> = {
  title: 'Components/CreateAndLinkRecordDialog',
  component: CreateAndLinkRecordDialog<Payload>,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof CreateAndLinkRecordDialog<Payload>>

// No extraField — the original ClubStructure.tsx Section↔ClubContact create-and-link UX.
export const Default: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    title: 'Create a new contact',
    formId: TEST_FORM_ID,
    renderForm: (onSubmit) => <TestForm onSubmit={onSubmit} />,
    onCreateAndLink: () => undefined,
  },
}

// extraField supplied — Team↔ClubContact's create-and-link flow, which still needs the
// team-specific "Role" captured alongside the brand-new ClubContact.
export const WithExtraField: Story = {
  args: {
    ...Default.args,
    title: 'Create a new contact and link it to this team',
    extraField: { label: 'Role', quickFillOptions: ['Manager', 'Coach', 'Assistant Coach'] },
  },
}

export const Pending: Story = {
  args: {
    ...Default.args,
    isPending: true,
  },
}

export const WithError: Story = {
  args: {
    ...Default.args,
    isError: true,
    errorMessage: "Couldn't create and link this record. Please try again.",
  },
}

export const MobileViewport: Story = {
  args: WithExtraField.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: WithExtraField.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: WithExtraField.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
