import { useState } from 'react'
import { ConfirmDialog } from '../ConfirmDialog'

// docs/specs/114-share-result.md (Edited text): the editable WhatsApp and Facebook text. It shows the built text until the
// manager types in it; after that a template or switch change asks "Replace your edits?" first (the change is only applied
// when confirmed). Edits are never remembered.
export function useEditableShareText(generated: string) {
  const [override, setOverride] = useState<string | null>(null)
  const [pending, setPending] = useState<(() => void) | null>(null)
  const edited = override !== null && override !== generated

  // Runs `change` straight away when nothing was typed, otherwise after the manager confirms.
  const guard = (change: () => void) => {
    if (!edited) {
      setOverride(null)
      change()
      return
    }
    setPending(() => change)
  }

  const confirmDialog = (
    <ConfirmDialog
      open={pending !== null}
      title="Replace your edits?"
      description="Changing this rebuilds the text and replaces the changes you typed."
      confirmLabel="Replace"
      onConfirm={() => {
        setOverride(null)
        pending?.()
        setPending(null)
      }}
      onClose={() => setPending(null)}
    />
  )

  return { text: override ?? generated, setText: setOverride, edited, guard, confirmDialog }
}
