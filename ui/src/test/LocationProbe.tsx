import { useLocation } from 'react-router-dom'

// Shows the current path and query so a test can assert where a screen navigated to.
export function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}
