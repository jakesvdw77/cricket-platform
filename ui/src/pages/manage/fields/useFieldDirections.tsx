import type { ReactNode } from 'react'
import { directionsMenuItems, useGetDirections } from '../../../components/GetDirectionsButton'
import type { ManageMenuItem } from '../../../components/ManageMenu'
import type { PlayingArea } from '../../../api/playingAreaApi'
import { useDirectionsTarget } from '../../../hooks/useFieldLocation'

// docs/specs/133: the Get Directions item of the Manage Field menu (hidden when no point resolves) and the sheet it opens on a touch
// device. Called before any early return of the page, so `field` may still be loading.
export function useFieldDirections(field: PlayingArea | null | undefined): { items: ManageMenuItem[]; sheet: ReactNode } {
  const target = useDirectionsTarget(field)
  const { start, sheet } = useGetDirections(target)
  return { items: directionsMenuItems(target, start), sheet }
}
