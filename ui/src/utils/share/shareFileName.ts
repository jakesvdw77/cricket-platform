import type { ShareResultModel } from './shareResultData'

// docs/specs/114-share-result.md (Preview and delivery): "<home> v <away> <yyyy-mm-dd>.<ext>", team names only (never a
// player name), made safe for file systems.
const clean = (name: string): string =>
  name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export function shareFileName(model: Pick<ShareResultModel, 'home' | 'away' | 'dateIso'>, extension: string): string {
  return `${clean(model.home.name)} v ${clean(model.away.name)} ${model.dateIso}.${extension}`
}
