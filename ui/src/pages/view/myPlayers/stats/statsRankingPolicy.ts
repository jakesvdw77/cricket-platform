// docs/specs/147 AMENDMENT: until the owner has taken legal advice on ranking children, every ranking of one player against others is
// shown to every held player. The decision lives in one place on each side (the server's HubRankingPolicy and this helper), so a club
// switch, an age rule or a legal restriction can be added later without touching a card. A card shows a ranking line only when the
// payload field is non-null AND this allows it.
export const allowsRankings = (): boolean => true
