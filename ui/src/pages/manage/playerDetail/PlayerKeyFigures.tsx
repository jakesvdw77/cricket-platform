import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import TagOutlinedIcon from '@mui/icons-material/TagOutlined'
import { ageFromDateOfBirth, formatDateOfBirth, NOT_ON_FILE } from '../../../utils/playerFormat'
import type { Player } from '../../../api/playerApi'

function Tile({ icon, value, label, testId }: { icon: ReactNode; value: string; label: string; testId: string }) {
  return (
    <Box
      data-testid={testId}
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.25, md: 1.75 },
        minWidth: 0,
        bgcolor: 'background.paper',
        borderRadius: 1,
        boxShadow: 1,
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.25, md: 1.75 },
        '& .tile-icon': {
          width: { xs: 36, md: 44 },
          height: { xs: 36, md: 44 },
          flex: 'none',
          borderRadius: { xs: 1, md: 1.25 },
          bgcolor: alpha(theme.palette.primary.main, 0.12),
          color: 'primary.dark',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      })}
    >
      <Box className="tile-icon" aria-hidden>
        {icon}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Typography
          component="b"
          data-testid={`${testId}-value`}
          sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, lineHeight: 1.1, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.8125rem' } }}>
          {label}
        </Typography>
      </Box>
    </Box>
  )
}

// docs/specs/088 section G: the four numbers a manager wants first on the Player page. The games come from the
// platform's own selections (the list endpoint); the jersey number and age come from the profile.
export function PlayerKeyFigures({ player, now }: { player: Player; now?: Date }) {
  const age = ageFromDateOfBirth(player.dateOfBirth, now)
  return (
    <Box
      data-testid="player-key-figures"
      sx={{ display: 'grid', gap: { xs: 1, md: 1.5 }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}
    >
      <Tile testId="key-figure-season" icon={<EventAvailableOutlinedIcon />} value={String(player.gamesThisSeason)} label="Games this season" />
      <Tile testId="key-figure-overall" icon={<HistoryOutlinedIcon />} value={String(player.gamesOverall)} label="Games overall" />
      <Tile
        testId="key-figure-jersey"
        icon={<TagOutlinedIcon />}
        value={player.jerseyNumber != null ? `#${player.jerseyNumber}` : NOT_ON_FILE}
        label="Jersey number"
      />
      <Tile
        testId="key-figure-age"
        icon={<CakeOutlinedIcon />}
        value={age != null ? String(age) : NOT_ON_FILE}
        label={player.dateOfBirth ? `Age · born ${formatDateOfBirth(player.dateOfBirth)}` : 'No date of birth'}
      />
    </Box>
  )
}
