import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import { InfoCard } from '../../../components/InfoCard'
import type { PlayerStats } from '../../../api/playerStatsApi'
import { CardGrid, NotCapturedPanel,  } from './statsParts'
import { notCapturedFor } from './statsFormat'

// docs/specs/103-player-stats.md decision 23, the Awards & record tab: Player of the match, Team player of the match, Won
// and Lost as tiles, then the Awards and Record while playing cards. The Not captured yet panel shows only when the
// response has items for this tab (none today).
export function AwardsTab({ stats }: { stats: PlayerStats }) {
  const { record, basis } = stats
  return (
    <>
      <CardGrid>
        <InfoCard flat fieldSize="large"
          title="Record while playing"
          icon={<HistoryOutlinedIcon />}
          fields={[
            { label: 'Matches', value: String(basis.matchesCounted) },
            { label: 'Won', value: String(record.won) },
            { label: 'Lost', value: String(record.lost) },
            { label: 'Tied', value: String(record.tied) },
            { label: 'Drawn', value: String(record.drawn) },
            { label: 'Internal matches', value: String(record.internal) },
          ]}
        />
      </CardGrid>

      <NotCapturedPanel items={notCapturedFor(stats.notCaptured, 'awards')} />
    </>
  )
}
