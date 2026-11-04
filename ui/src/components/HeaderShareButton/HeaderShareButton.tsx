import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { Button } from '../Button'

export interface HeaderShareButtonProps {
  onClick: () => void
  testId?: string
}

// docs/standards/page-anatomy.md (owner, 2026-11-05): the one exception to a single header button. A page whose record can be shared
// shows an outlined Share beside the filled Manage menu, only while sharing makes sense (a published result, an announced team, a league,
// a match, an open poll). The menu keeps its own Share item, last. 32 px high like the menu button. Place it with `HeaderActions`.
export function HeaderShareButton({ onClick, testId = 'header-share' }: HeaderShareButtonProps) {
  return (
    <Button variant="secondary" size="compact" startIcon={<ShareOutlinedIcon />} onClick={onClick} data-testid={testId}>
      Share
    </Button>
  )
}
