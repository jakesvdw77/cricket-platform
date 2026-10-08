import { Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { JumpToTodayButton } from '../pages/manage/availability/JumpToTodayButton'
import { useAvailabilityHubState } from '../pages/manage/availability/hubContext'

// Test stand-in for AvailabilityHubLayout (docs/specs/083): same shared filters and season state, handed
// to the view under test through the Outlet context, without the header, switch or counters. Reads the
// club id from the parent route's Outlet context, as the real layout does. Also prints the address so a
// test can assert the filters are mirrored in it.
export function AvailabilityHubStub() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const hub = useAvailabilityHubState(clubId, true)
  const { pathname, search } = useLocation()
  return (
    <>
      <div data-testid="hub-location">{`${pathname}${search}`}</div>
      {/* The header action slot (085 D2), as the real layout renders it. */}
      <div data-testid="hub-header-action">{hub.jumpToToday && <JumpToTodayButton action={hub.jumpToToday} />}</div>
      <Outlet context={hub} />
    </>
  )
}
