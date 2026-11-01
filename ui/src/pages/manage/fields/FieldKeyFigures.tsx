import { Box } from '@mui/material'
import { PageCounters } from '../../../components/PageCounters'
import type { PageCounterItem } from '../../../components/PageCounters'
import { cityLine, FIELD_CATEGORY_LABEL } from '../../../utils/fieldLabels'
import { NOT_ON_FILE } from '../../../utils/playerFormat'
import type { PlayingArea } from '../../../api/playingAreaApi'

// docs/specs/134 and page-anatomy section 2: the figures of a field's page as STATIC compact counters (no icons, no pointer): Type,
// Owner, City, the matches on it and, for a club, whether it is one of the club's own fields (for the platform admin: how many
// clubs use it). Text values are allowed.
function fieldCounters(field: PlayingArea, platform: boolean): PageCounterItem[] {
  return [
    { id: 'type', testId: 'field-figure-type', value: FIELD_CATEGORY_LABEL[field.category], label: 'Type' },
    { id: 'owner', testId: 'field-figure-owner', value: field.ownerName || NOT_ON_FILE, label: 'Owner' },
    { id: 'city', testId: 'field-figure-city', value: cityLine(field) || NOT_ON_FILE, label: 'City' },
    { id: 'matches', testId: 'field-figure-matches', value: String(field.matchCount ?? 0), label: platform ? 'Matches Using It' : 'Matches Here' },
    platform
      ? { id: 'clubs', testId: 'field-figure-clubs', value: String(field.linkedClubCount ?? 0), label: 'Clubs Using It' }
      : { id: 'ours', testId: 'field-figure-ours', value: field.linkedHome ? 'Yes' : 'No', label: 'Our Field' },
  ]
}

export function FieldKeyFigures({ field, platform = false }: { field: PlayingArea; platform?: boolean }) {
  return (
    <Box data-testid="field-key-figures">
      <PageCounters items={fieldCounters(field, platform)} density="compact" />
    </Box>
  )
}
