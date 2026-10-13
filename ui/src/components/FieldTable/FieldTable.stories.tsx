import type { Meta, StoryObj } from '@storybook/react-vite'
import { FieldTable } from './FieldTable'
import { makeField } from '../../test/fieldFixtures'

const FIELDS = [
  makeField({ id: 'f1', linkedHome: true }),
  makeField({ id: 'f2', name: 'Hilton College Oval', category: 'SCHOOL', verificationStatus: 'UNVERIFIED', matchCount: 0 }),
  makeField({ id: 'f3', name: 'Old Boys Ground', verificationStatus: 'REJECTED', ownerName: '', mapUrl: null }),
]

const meta: Meta<typeof FieldTable> = {
  title: 'Components/FieldTable',
  component: FieldTable,
  parameters: { layout: 'padded' },
  args: { fields: FIELDS, viewTo: (field) => `/manage/fixtures/fields/${field.id}`, onToggleHome: () => undefined },
}
export default meta

type Story = StoryObj<typeof FieldTable>

export const Manager: Story = {}
export const PlatformAdmin: Story = { args: { onToggleHome: undefined, onStatusAction: () => undefined } }
export const MobileViewport: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }
