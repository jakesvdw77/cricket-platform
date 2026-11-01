import type { Meta, StoryObj } from '@storybook/react-vite'
import { FieldTable } from './FieldTable'
import { makeField } from '../../test/fieldFixtures'
import { ManageMenu } from '../ManageMenu'

const FIELDS = [
  makeField({ id: 'f1', linkedHome: true }),
  makeField({ id: 'f2', name: 'Hilton College Oval', category: 'SCHOOL', verificationStatus: 'UNVERIFIED', matchCount: 0 }),
  makeField({ id: 'f3', name: 'Old Boys Ground', verificationStatus: 'REJECTED', ownerName: '', mapUrl: null }),
]

const meta: Meta<typeof FieldTable> = {
  title: 'Components/FieldTable',
  component: FieldTable,
  parameters: { layout: 'padded' },
  args: { fields: FIELDS, viewTo: (field) => `/manage/fixtures/fields/${field.id}`, rowActions: (field) => <ManageMenu trigger="kebab" dense label={`Actions for ${field.name}`} groups={[{ id: 'a', heading: 'Actions', items: [{ id: 'open', title: 'Open Field' }] }]} /> },
}
export default meta

type Story = StoryObj<typeof FieldTable>

export const Manager: Story = {}
export const PlatformAdmin: Story = {
  args: { rowActions: (field) => <ManageMenu trigger="kebab" dense label={`Actions for ${field.name}`} groups={[{ id: 'a', heading: 'Actions', items: [{ id: 'open', title: 'Open Field' }, { id: 'verify', title: 'Verify' }] }]} /> },
}
export const MobileViewport: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }
