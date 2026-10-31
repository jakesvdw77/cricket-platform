import type { KeyboardEvent } from 'react'

// Enter saves and Escape cancels, from any input of the row (a button keeps its own Enter).
export function editKeyHandler(onSave: () => void, onCancel: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    } else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault()
      onSave()
    }
  }
}
