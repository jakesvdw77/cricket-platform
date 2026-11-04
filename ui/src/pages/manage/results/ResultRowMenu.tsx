import { useLocation } from 'react-router-dom'
import { ManageMenu } from '../../../components/ManageMenu'
import type { ResultListItem } from '../../../api/matchResultApi'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { resultEditTo, resultViewTo } from './resultListHelpers'
import { resultMenuItems } from './resultMenuItems'

export interface ResultRowMenuProps {
  item: ResultListItem
  title: string
  onPublish: (item: ResultListItem) => void
  onShare: (item: ResultListItem) => void
}

// docs/specs/138 and page-anatomy section 6: the ONE actions button of a result row or card, a dense kebab. Every destination returns to the
// Results list ("Results", docs/specs/127). It never navigates the row it sits in.
export function ResultRowMenu({ item, title, onPublish, onShare }: ResultRowMenuProps) {
  const location = useLocation()
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), 'Results')
  const items = resultMenuItems({
    draft: item.result.status === 'DRAFT',
    openTo: leaveTo(resultViewTo(item.match.id)),
    editTo: leaveTo(resultEditTo(item.match.id)),
    onPublish: () => onPublish(item),
    onShare: () => onShare(item),
  })
  return <ManageMenu trigger="kebab" dense label={`Actions for ${title}`} testId={`result-actions-${item.match.id}`} groups={[{ id: 'actions', heading: 'Actions', items }]} />
}
