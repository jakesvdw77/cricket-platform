import { EmptyState } from '../../../components/EmptyState'

// docs/specs/093-team-selection-hub.md: the Players, Time slots and Batting order views are built in later slices;
// until then their routes show this note.
export function PlaceholderView({ title }: { title: string }) {
  return <EmptyState title={title} description="This view is coming soon." />
}
