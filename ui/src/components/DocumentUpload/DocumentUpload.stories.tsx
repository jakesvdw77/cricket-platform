import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
import { DocumentUpload } from './DocumentUpload'

const meta: Meta<typeof DocumentUpload> = {
  title: 'Components/DocumentUpload',
  component: DocumentUpload,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof DocumentUpload>

export const Empty: Story = {
  args: {
    label: 'Playing Conditions',
    value: null,
    onUpload: () => Promise.resolve('/media/playing-conditions.pdf'),
    onUploaded: () => undefined,
  },
}

export const Populated: Story = {
  args: {
    label: 'Playing Conditions',
    value: { documentUrl: '/media/2f6a1c9e-playing-conditions.pdf', uploadedAt: '2026-02-01T09:00:00Z' },
    onUpload: () => Promise.resolve('/media/2f6a1c9e-playing-conditions.pdf'),
    onUploaded: () => undefined,
  },
}

// Uploading is local state only reachable via interaction, not a settable prop — the play
// function selects a file via the hidden input (same convention MediaUpload.test.tsx uses) with
// an onUpload that never resolves, so the story settles on the in-flight state rather than
// racing past it. Same "exercise it via play" posture as TeamSheetCommunicationDialog's own
// ErrorState/WhatsAppSelected stories.
export const Uploading: Story = {
  args: {
    label: 'Playing Conditions',
    value: null,
    onUpload: () => new Promise<string>(() => undefined),
    onUploaded: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    const file = new File(['%PDF-1.4'], 'playing-conditions.pdf', { type: 'application/pdf' })
    await userEvent.upload(canvas.getByLabelText('Playing Conditions file'), file)
    await canvas.findByText('Uploading…')
  },
}

// Named ErrorState, not Error — a local `const Error` shadows the global `Error` constructor
// within this module's scope, which breaks Storybook's own CSF typings (same reasoning
// TeamSheetCommunicationDialog.stories.tsx's own ErrorState story name already follows).
export const ErrorState: Story = {
  args: {
    label: 'Playing Conditions',
    value: null,
    onUpload: () => Promise.reject(new Error('network error')),
    onUploaded: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    const file = new File(['%PDF-1.4'], 'playing-conditions.pdf', { type: 'application/pdf' })
    await userEvent.upload(canvas.getByLabelText('Playing Conditions file'), file)
    await canvas.findByText('Something went wrong uploading "playing-conditions.pdf". Please try again.')
  },
}

// docs/standards/design-system.md's Storybook rule — every component gets a story with the
// viewport addon at 375/768/1280.
export const MobileViewport: Story = {
  args: Populated.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Populated.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Populated.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
