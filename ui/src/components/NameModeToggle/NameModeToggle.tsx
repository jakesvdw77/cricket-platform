import { ToggleButton } from '@mui/material'
import { usePlayerNameMode } from '../../hooks/usePlayerNameMode'
import { CompactToggleGroup } from '../CompactToggleGroup'

// docs/specs/101-match-results-our-side-scorecard.md (Player name display toggle): the Full name | First name switch at
// the top of every scorecard step, the Review step and the result page. It reads and writes the one remembered
// preference (hooks/usePlayerNameMode), so every PlayerName on the page changes with it. `fullWidthOnPhone` gives the
// 40 px buttons the phone needs.
// `inline` keeps it compact (not full width on a phone) for a header row that holds other controls (the Review preview card).
export function NameModeToggle({ inline = false }: { inline?: boolean } = {}) {
  const [mode, setMode] = usePlayerNameMode()
  return (
    <CompactToggleGroup value={mode} onChange={setMode} ariaLabel="Player names" fullWidthOnPhone={!inline}>
      <ToggleButton value="full" aria-label="Full name">
        Full name
      </ToggleButton>
      <ToggleButton value="first" aria-label="First name">
        First name
      </ToggleButton>
    </CompactToggleGroup>
  )
}
