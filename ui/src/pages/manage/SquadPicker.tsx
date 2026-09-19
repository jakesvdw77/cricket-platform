import { useNavigate } from 'react-router-dom'
import MatchList from './MatchList'

// The "Squads" dashboard card's real destination (006's own copy, "Pick squads per match",
// already anticipated this exact flow) — reuses MatchList's same paginated data source and card
// shape, but each card's primary action jumps straight to that match's Playing XI tab on
// MatchFormPage rather than its Details tab. This is the same underlying Match data as
// /manage/fixtures/matches, a different entry point optimized for "I need to pick today's XI,"
// not a second parallel list (docs/specs/029-league-management.md's Rollout Notes).
export default function SquadPicker() {
  const navigate = useNavigate()

  return (
    <MatchList
      title="Squads"
      backTo="/manage"
      backLabel="Back to Dashboard"
      createLabel="Schedule Match"
      editTo={(matchId) => `/manage/fixtures/matches/${matchId}/edit?tab=playing-xi`}
      // docs/specs/036-view-first-record-detail-screens.md: opts out of MatchList's new
      // view-first default — this card's whole purpose is a shortcut straight into the Playing XI
      // tab, an editing entry point, not the record's read-only view screen.
      viewTo={null}
      onCreate={() => navigate('/manage/fixtures/matches/new')}
    />
  )
}
