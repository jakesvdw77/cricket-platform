import type { DuplicateLeagueResponse } from '../../../api/leagueApi'

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

// docs/specs/096-duplicate-league.md: the one-line success notice shown on the new league's edit page, built from the
// response counts. Parts that are zero (or were not requested, so came back zero) are left out.
export function duplicateLeagueNotice(response: DuplicateLeagueResponse): string {
  const conditions =
    response.playingConditionsCopied > 0
      ? `Playing conditions copied for ${plural(response.playingConditionsCopied, 'season', 'seasons')}`
      : null
  const contacts = response.contactsCopied > 0 ? plural(response.contactsCopied, 'contact', 'contacts') : null

  let copied = ''
  if (conditions && contacts) {
    copied = ` ${conditions}, ${contacts}.`
  } else if (conditions) {
    copied = ` ${conditions}.`
  } else if (contacts) {
    copied = ` ${contacts} copied.`
  }
  return `${response.name} created.${copied} Add its teams next.`
}
