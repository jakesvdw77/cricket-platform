import type { Meta, StoryObj } from '@storybook/react-vite'
import { FieldRowMenu } from './FieldRowMenu'
import { makeField } from '../../../test/fieldFixtures'

const meta: Meta<typeof FieldRowMenu> = {
  title: 'Pages/Manage/FieldRowMenu',
  component: FieldRowMenu,
  args: { field: makeField({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' }), clubId: 'club-1', onToggleHome: () => undefined },
}
export default meta

type Story = StoryObj<typeof FieldRowMenu>

// docs/specs/134: the kebab of a field row or card (manager): Open Field, Edit Field, Open In Maps, Add To / Remove From Our Fields.
export const Manager: Story = {}
// Edit Field stays in the menu, disabled with its reason, when this club cannot edit the field.
export const ManagerVerifiedField: Story = { args: { field: makeField({ linkedHome: true }) } }
// The platform admin's kebab swaps the Our Fields choice for Verify, Reject or Reopen; Merge is on the field page only.
export const PlatformAdmin: Story = { args: { admin: true, clubId: undefined, onToggleHome: undefined, onStatusAction: () => undefined } }
