import { HubSoonPanel } from './HubSoonPanel'

// docs/specs/121 checkpoint A: a Soon-style placeholder for Club, Field Directory. The real screen (search, field cards,
// Directions, read-only, club scoped) is checkpoint B; the item is not flagged `soon` in hubNav.ts so Club opens on it.
export function HubFields() {
  return <HubSoonPanel title="Field Directory" copy="The fields your club plays on, with directions. Coming in the next step." />
}
