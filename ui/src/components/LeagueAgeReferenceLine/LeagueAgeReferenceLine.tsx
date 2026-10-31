import { Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { ageReferenceKey, getLeagueAgeReference } from '../../api/leagueApi'
import { ageReferenceWording } from '../../utils/ageCutoff'

export interface LeagueAgeReferenceLineProps {
  clubId: string | undefined
  leagueId: string | undefined
  seasonId: string
  // The line only makes sense for a league that has an age limit.
  hasAgeLimit: boolean
}

// docs/specs/110-league-age-cutoff-day-and-month.md: one quiet line saying which date ages are judged on for the
// league in the chosen season, read from the server so the manager sees the date eligibility really uses. Nothing is
// shown while it loads, on an error, or for a league with no age limit.
export function LeagueAgeReferenceLine({ clubId, leagueId, seasonId, hasAgeLimit }: LeagueAgeReferenceLineProps) {
  const enabled = hasAgeLimit && Boolean(clubId) && Boolean(leagueId) && Boolean(seasonId)
  const { data } = useQuery({
    queryKey: ageReferenceKey(clubId ?? '', leagueId ?? '', seasonId),
    queryFn: () => getLeagueAgeReference(clubId as string, leagueId as string, seasonId),
    enabled,
    retry: false,
  })

  if (!enabled || !data?.referenceDate) {
    return null
  }

  return (
    <Typography variant="body2" color="text.secondary" data-testid="league-age-reference">
      {ageReferenceWording(data).sentence}
    </Typography>
  )
}
