import { createContext } from 'react'

// Owner, 2026-11-17 (docs/mockups/hub-phone-footer-mockup.html): on a phone the Back button sits at the top left of the shell's bar, not in the
// footer, which is left to the ticker. The shell (AccountShell) owns the slot and offers it here; a Hub page portals its Back into it.
export const PhoneBackSlotContext = createContext<HTMLElement | null>(null)
