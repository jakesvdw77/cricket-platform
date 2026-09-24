// docs/specs/051-league-schedule-sharing.md: this codebase's first forced-download helper —
// every generated/uploaded document before this spec opens via `window.open(url, '_blank')`
// instead (a PDF has a meaningful browser-native viewer to open into). The Poster PNG and the
// `.ics` calendar file have nothing meaningful to preview in a browser tab, so both are delivered
// as a forced download via this shared helper instead. Purely mechanical DOM/browser-API glue
// (create a temporary `<a download>`, click it, clean up) — not the "small resolution helper"
// duplicated per-file elsewhere in this feature (see leagueSchedulePdf.ts's own doc comment),
// since there's no data-shaped logic here to keep each file self-contained around.
export function triggerDownload(blobUrl: string, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(blobUrl)
}
