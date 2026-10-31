import { ManageMenu } from '../../../components/ManageMenu'
import type { ManageMenuItem } from '../../../components/ManageMenu'
import { LeagueTabActions } from './LeagueTabActions'

interface LeagueTabMenuProps {
  // "Manage Schedule", "Manage Teams" or "Manage Playing Conditions".
  label: string
  heading: string
  testId: string
  // Actions first, Share last (docs/standards/page-anatomy.md).
  items: ManageMenuItem[]
}

// Each league tab's one action: a white "Manage X" menu button on the tab strip row, the same ManageMenu as the title row's filled
// Manage League and the same fixed width (MANAGE_BUTTON_WIDTH), so the two share one right edge.
export function LeagueTabMenu({ label, heading, testId, items }: LeagueTabMenuProps) {
  return (
    <LeagueTabActions>
      <ManageMenu label={label} testId={testId} buttonVariant="secondary" fixedWidth groups={[{ id: testId, heading, items }]} />
    </LeagueTabActions>
  )
}
