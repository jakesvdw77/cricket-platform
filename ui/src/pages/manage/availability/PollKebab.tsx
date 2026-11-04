import { ManageMenu } from '../../../components/ManageMenu'
import type { PollActions } from './usePollActions'

export interface PollKebabProps {
  actions: PollActions
  title: string
  testId: string
}

// The dense kebab of a poll (docs/standards/page-anatomy.md section 6): used by the card (which owns its actions so it can show
// their failures) and by PollRowMenu.
export function PollKebab({ actions, title, testId }: PollKebabProps) {
  return <ManageMenu trigger="kebab" dense label={`Actions for ${title}`} testId={testId} groups={[{ id: 'actions', heading: 'Actions', items: actions.items }]} />
}
