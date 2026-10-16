import { createContext, useContext } from 'react'
import type { ImportNote } from '../../../../api/resultImportApi'

// docs/specs/104: what the capture wizard knows about an imported draft, for the Guess chips and the Teams banner without
// threading it through every step: the provider (null when the result was not imported) and what the import said about each
// name. A manual result gets the empty default, so nothing renders.
export interface ImportReview {
  provider: string | null
  notes: ImportNote[]
}

export const ImportReviewContext = createContext<ImportReview>({ provider: null, notes: [] })

export const useImportReview = () => useContext(ImportReviewContext)
