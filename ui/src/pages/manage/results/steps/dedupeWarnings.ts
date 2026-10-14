import type { MarginCheck } from '../../../../utils/marginCheck'

// The server already words some of what the scores check says (margin against scores, wrong batting side for the margin).
// When the client check has its own finding for those, the server's version is dropped so each problem is listed once.
// Kept in step with the margin messages in backend ResultValidator.java; dedupeWarnings.test.ts feeds the real wording through.
const MARGIN_WARNING_PATTERNS = [
  /^The scores differ by \d+ runs, but the margin is/,
  / lost \d+ wickets, but the margin is/,
  / won by (runs but batted second|wickets but batted first)\.$/,
  /^The match is recorded as a tie but the two innings are not level\.$/,
  / scored more, but .* is marked as the winner\.$/,
  /^The scores are level\. Was it a tie/,
  / scored more in the super over, but /,
  /^The super over is level too/,
  / won chasing a DLS target of /,
  / reached the DLS target of /,
]

export function dedupeWarnings(warnings: string[], check: MarginCheck): string[] {
  if (check.status !== 'mismatch') return warnings
  return warnings.filter((line) => !MARGIN_WARNING_PATTERNS.some((pattern) => pattern.test(line)))
}
