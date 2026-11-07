import { createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

// docs/specs/147: the empty container in a card front's title row (between the title and the expand button). The shell provides it to the
// front only (the back has none); a front renders its controls into it with CardHeaderControls. Null while it is not yet mounted or not
// available (the empty state), and then the controls render inline at the top of the content instead.
export const CardHeaderSlotContext = createContext<HTMLElement | null>(null)
export const useCardHeaderSlot = (): HTMLElement | null => useContext(CardHeaderSlotContext)

export function CardHeaderControls({ children }: { children: ReactNode }) {
  const slot = useCardHeaderSlot()
  return slot ? createPortal(children, slot) : <>{children}</>
}
