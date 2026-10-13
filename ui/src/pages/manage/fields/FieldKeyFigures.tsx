import { Box } from '@mui/material'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined'
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import { KeyFigureTile } from '../../../components/KeyFigureTile'
import { cityLine, FIELD_CATEGORY_LABEL } from '../../../utils/fieldLabels'
import { NOT_ON_FILE } from '../../../utils/playerFormat'
import type { PlayingArea } from '../../../api/playingAreaApi'

// docs/specs/099-fields-directory.md (4): the numbers a manager wants first on a field's page - Type, Owner, City, the
// matches on it and, for a club, whether it is one of the club's own fields (for the platform admin: how many clubs use it).
export function FieldKeyFigures({ field, platform = false }: { field: PlayingArea; platform?: boolean }) {
  return (
    <Box
      data-testid="field-key-figures"
      sx={{
        display: 'grid',
        gap: { xs: 1, md: 1.5 },
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' },
      }}
    >
      <KeyFigureTile testId="field-figure-type" icon={<LabelOutlinedIcon />} value={FIELD_CATEGORY_LABEL[field.category]} label="Type" textValue />
      <KeyFigureTile testId="field-figure-owner" icon={<StorefrontOutlinedIcon />} value={field.ownerName || NOT_ON_FILE} label="Owner" textValue />
      <KeyFigureTile testId="field-figure-city" icon={<PlaceOutlinedIcon />} value={cityLine(field) || NOT_ON_FILE} label="City" textValue />
      <KeyFigureTile
        testId="field-figure-matches"
        icon={<EventAvailableOutlinedIcon />}
        value={String(field.matchCount ?? 0)}
        label={platform ? 'Matches using it' : 'Matches here'}
      />
      {platform ? (
        <KeyFigureTile testId="field-figure-clubs" icon={<GroupsOutlinedIcon />} value={String(field.linkedClubCount ?? 0)} label="Clubs using it" />
      ) : (
        <KeyFigureTile testId="field-figure-ours" icon={<HomeWorkOutlinedIcon />} value={field.linkedHome ? 'Yes' : 'No'} label="Our field" textValue />
      )}
    </Box>
  )
}
