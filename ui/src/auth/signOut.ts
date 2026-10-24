import { useSyncExternalStore } from 'react'
import { keycloak } from './keycloak'

// Sign-out hands the browser to Keycloak, which takes a moment. This flag lets App show the sign-out screen
// (cricket backdrop and ball) meanwhile instead of the old page sitting there frozen.
let signingOut = false
const listeners = new Set<() => void>()

export function signOut(): void {
  signingOut = true
  listeners.forEach((listener) => listener())
  keycloak.logout()
}

export function useSigningOut(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => signingOut,
  )
}
