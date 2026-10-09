import { Box } from '@mui/material'
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import TagOutlinedIcon from '@mui/icons-material/TagOutlined'
import { KeyFigureTile } from '../../../components/KeyFigureTile'
import { ageFromDateOfBirth, formatDateOfBirth, NOT_ON_FILE } from '../../../utils/playerFormat'
import type { Player } from '../../../api/playerApi'

// docs/specs/088 section G: the four numbers a manager wants first on the Player page. The games come from the
// platform's own selections (the list endpoint); the jersey number and age come from the profile.
export function PlayerKeyFigures({ player, now }: { player: Player; now?: Date }) {
  const age = ageFromDateOfBirth(player.dateOfBirth, now)
  return (
    <Box
      data-testid="player-key-figures"
      sx={{ display: 'grid', gap: { xs: 1, md: 1.5 }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}
    >
      <KeyFigureTile testId="key-figure-season" icon={<EventAvailableOutlinedIcon />} value={String(player.gamesThisSeason)} label="Games this season" />
      <KeyFigureTile testId="key-figure-overall" icon={<HistoryOutlinedIcon />} value={String(player.gamesOverall)} label="Games overall" />
      <KeyFigureTile
        testId="key-figure-jersey"
        icon={<TagOutlinedIcon />}
        value={player.jerseyNumber != null ? `#${player.jerseyNumber}` : NOT_ON_FILE}
        label="Jersey number"
      />
      <KeyFigureTile
        testId="key-figure-age"
        icon={<CakeOutlinedIcon />}
        value={age != null ? String(age) : NOT_ON_FILE}
        label={player.dateOfBirth ? `Age · born ${formatDateOfBirth(player.dateOfBirth)}` : 'No date of birth'}
      />
    </Box>
  )
}
