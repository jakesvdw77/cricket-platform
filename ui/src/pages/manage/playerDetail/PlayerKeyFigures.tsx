import { Box } from '@mui/material'
import { KeyFigureTile } from '../../../components/KeyFigureTile'
import { ageFromDateOfBirth, NOT_ON_FILE } from '../../../utils/playerFormat'
import type { Player } from '../../../api/playerApi'

// docs/specs/088 section G: the four numbers a manager wants first on the Player page. The games come from the
// platform's own selections (the list endpoint); the jersey number and age come from the profile.
export function PlayerKeyFigures({ player, now }: { player: Player; now?: Date }) {
  const age = ageFromDateOfBirth(player.dateOfBirth, now)
  return (
    <Box
      data-testid="player-key-figures"
      sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}
    >
      <KeyFigureTile testId="key-figure-season" value={String(player.gamesThisSeason)} label="Games This Season" counter />
      <KeyFigureTile testId="key-figure-overall" value={String(player.gamesOverall)} label="Games Overall" counter />
      <KeyFigureTile
        testId="key-figure-jersey"
       
        value={player.jerseyNumber != null ? `#${player.jerseyNumber}` : NOT_ON_FILE}
        label="Jersey Number" counter
      />
      <KeyFigureTile
        testId="key-figure-age"
       
        value={age != null ? String(age) : NOT_ON_FILE}
        label="Age" counter
      />
    </Box>
  )
}
