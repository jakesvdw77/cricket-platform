import type { PlayerStats } from '../../../api/playerStatsApi'
import { NotCapturedPanel,  } from './statsParts'
import { notCapturedFor } from './statsFormat'

// docs/specs/103-player-stats.md, the Fielding tab: the three counts and dismissals per match as counters, then the
// Not captured yet panel (docs/specs/141: the Fielding card repeated the same numbers, so it is gone) (Awards and Record while playing live on the Awards & record tab).
export function FieldingTab({ stats }: { stats: PlayerStats }) {
  return (
    <>
      <NotCapturedPanel items={notCapturedFor(stats.notCaptured, 'fielding')} />
    </>
  )
}
