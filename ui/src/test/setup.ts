import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

// Toolbar filters are remembered in localStorage (owner decision 2026-11-16), so every test starts from empty storage: what one test
// chooses must never carry into the next.
beforeEach(() => {
  try {
    localStorage.clear()
  } catch {
    // no storage in this environment
  }
})
