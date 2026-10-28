import { useEffect, useMemo, useState } from 'react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { generateLeagueSharePoster } from '../../utils/leagueSchedulePoster'
import { leagueShareFileName } from '../../utils/share/shareLeagueData'
import type { LeagueShareModel } from '../../utils/share/shareLeagueData'

export const LEAGUE_POSTER_ERROR = 'The poster could not be created. Try again.'

// Makes the poster (debounced) and hands out the PNG file, only while it was made from the current model and options (the
// preview shows this very file). `model` must be memoised by the caller.
export function useLeaguePosterOutput(model: LeagueShareModel, colour: string, teamLogos: boolean) {
  const input = useMemo(() => ({ model, colour, teamLogos }), [model, colour, teamLogos])
  const debounced = useDebouncedValue(input, 250)
  const [made, setMade] = useState<{ input: object; file: File } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    generateLeagueSharePoster(debounced.model, debounced.colour, { teamLogos: debounced.teamLogos })
      .then(async (url) => {
        try {
          const blob = await (await fetch(url)).blob()
          if (cancelled) return
          setError(null)
          setMade({ input: debounced, file: new File([blob], leagueShareFileName(debounced.model, 'png'), { type: 'image/png' }) })
        } finally {
          URL.revokeObjectURL(url)
        }
      })
      .catch(() => {
        if (!cancelled) setError(LEAGUE_POSTER_ERROR)
      })
    return () => {
      cancelled = true
    }
  }, [debounced])

  return { file: made && made.input === input ? made.file : null, error }
}
