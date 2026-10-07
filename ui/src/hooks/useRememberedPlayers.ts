import { useCallback, useEffect, useState } from 'react'
import {
  forgetClub,
  listRememberedPlayers,
  rememberPlayer,
  removeRememberedPlayer,
} from '../utils/rememberedPlayers'

export interface RememberedPlayerView {
  firstName: string
  lastName: string
  // ISO instant of the last answer to THIS poll, null when none yet.
  answeredAt: string | null
}

// docs/specs/077: reads and writes the device's remembered players for one club. clubId comes from
// the poll header, so it is null until that has loaded (no players until then). Every storage
// access is inside utils/rememberedPlayers' own try/catch, so this works with storage unavailable
// (it just stays empty).
export function useRememberedPlayers(clubId: string | null | undefined, pollId: string | undefined) {
  const [players, setPlayers] = useState<RememberedPlayerView[]>([])

  const reload = useCallback(() => {
    if (!clubId) {
      setPlayers([])
      return
    }
    setPlayers(
      listRememberedPlayers(clubId).map((p) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        answeredAt: (pollId && p.answered[pollId]) || null,
      })),
    )
  }, [clubId, pollId])

  useEffect(() => {
    reload()
  }, [reload])

  const remember = useCallback(
    (firstName: string, lastName: string) => {
      if (!clubId || !pollId) return
      rememberPlayer(clubId, pollId, firstName, lastName)
      reload()
    },
    [clubId, pollId, reload],
  )

  const remove = useCallback(
    (player: { firstName: string; lastName: string }) => {
      if (!clubId) return
      removeRememberedPlayer(clubId, player)
      reload()
    },
    [clubId, reload],
  )

  const forgetAll = useCallback(() => {
    if (!clubId) return
    forgetClub(clubId)
    reload()
  }, [clubId, reload])

  return { players, remember, remove, forgetAll }
}
