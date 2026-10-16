import type { ImportAdaptor, ImportInputFormat } from '../../../../api/resultImportApi'

// docs/specs/104: an imported result stores `source` as "IMPORT:<PROVIDER>" (a manual one is "MANUAL"). The provider as it
// was written, or null for a result that was not imported.
const PREFIX = 'IMPORT:'

export function importedProvider(source: string | null | undefined): string | null {
  if (!source || !source.startsWith(PREFIX)) return null
  return source.slice(PREFIX.length).trim() || null
}

// What the manager has chosen from the catalogue: the adaptor's input format (its first one until they pick another).
export function chosenInput(adaptor: ImportAdaptor | undefined, format: string | null): ImportInputFormat | undefined {
  return adaptor?.inputs.find((input) => input.format === format) ?? adaptor?.inputs[0]
}
