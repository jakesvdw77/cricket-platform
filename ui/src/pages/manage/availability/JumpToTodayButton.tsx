import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined'
import { Button } from '../../../components/Button'
import type { HubHeaderAction } from './hubContext'

// docs/specs/085 (D2): Jump to today as the hub header's action on Players. Rendered by AvailabilityHubLayout (and by
// the test stand-in) from the action the Players view registers in the hub context. Default size, so the header keeps
// the height New poll gives it on Polls.
export function JumpToTodayButton({ action }: { action: HubHeaderAction }) {
  return (
    <Button
      variant="secondary"
      startIcon={<TodayOutlinedIcon fontSize="small" />}
      disabled={action.disabled}
      onClick={action.onClick}
      sx={{ whiteSpace: 'nowrap', width: { xs: '100%', sm: 'auto' } }}
    >
      Jump to today
    </Button>
  )
}
