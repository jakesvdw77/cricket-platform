import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import StarOutlineIcon from '@mui/icons-material/StarOutline'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import { InfoCard } from '../../../components/InfoCard'
import type { PlayerStats } from '../../../api/playerStatsApi'
import { CardGrid, NotCapturedPanel, StatTile, StatTileStrip } from './statsParts'
import { notCapturedFor } from './statsFormat'

// docs/specs/103-player-stats.md decision 23, the Awards & record tab: Player of the match, Team player of the match, Won
// and Lost as tiles, then the Awards and Record while playing cards. The Not captured yet panel shows only when the
// response has items for this tab (none today).
export function AwardsTab({ stats }: { stats: PlayerStats }) {
  const { awards, record, basis } = stats
  return (
    <>
      <StatTileStrip>
        <StatTile testId="tile-potm" icon={<StarOutlineIcon />} label="Player of the match" value={String(awards.playerOfTheMatch)} />
        <StatTile testId="tile-team-potm" icon={<GroupsOutlinedIcon />} label="Team player of the match" value={String(awards.teamPlayerOfTheMatch)} />
        <StatTile testId="tile-won" tone="success" icon={<CheckCircleOutlineIcon />} label="Won" value={String(record.won)} />
        <StatTile testId="tile-lost" tone="error" icon={<HighlightOffIcon />} label="Lost" value={String(record.lost)} />
      </StatTileStrip>

      <CardGrid>
        <InfoCard fieldSize="large"
          title="Awards"
          icon={<EmojiEventsOutlinedIcon />}
          fields={[
            { label: 'Player of the match', value: String(awards.playerOfTheMatch) },
            { label: 'Team player of the match', value: String(awards.teamPlayerOfTheMatch) },
          ]}
        />
        <InfoCard fieldSize="large"
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
