import { Outlet, useLocation, useNavigate } from 'react-router-dom'

export function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

// Shows the current location so tests can assert redirects and ?seasonId= writes, and a Go back
// button so a test can tell whether a URL change replaced or pushed a history entry.
export function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <div data-testid="location">{`${location.pathname}${location.search}`}</div>
      <button type="button" onClick={() => navigate(-1)}>
        Go back
      </button>
    </>
  )
}
