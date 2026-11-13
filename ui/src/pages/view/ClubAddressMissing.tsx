import { StatusScreen } from '../../components/StatusScreen'
import { rootAddress } from '../../utils/clubFromHost'

// docs/specs/149, Decision 3: a club address that does not exist (unknown, inactive or malformed) never reaches Keycloak.
export function ClubAddressMissing() {
  return (
    <StatusScreen
      kind="not-found"
      title="That club address does not exist"
      message="Check the address for a typing mistake, or go to the general page and search for your club."
      primaryAction={{ label: 'Go To The General Page', href: rootAddress('/') }}
    />
  )
}
