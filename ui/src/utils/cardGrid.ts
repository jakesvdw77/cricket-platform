// The one card-grid layout shared by the Matches list and the availability polls dashboard, so both
// show the same default card size. auto-fill with a 380px floor (capped at 100% so a narrow phone
// never overflows): a card is never narrower than 380px, which leaves the icon-over-caption footer
// columns (four of them) comfortable room and long titles space to read. stretch makes every card in
// a row the height of the tallest, footer pinned at the bottom.
export const CARD_GRID_TEMPLATE_COLUMNS = 'repeat(auto-fill, minmax(min(380px, 100%), 1fr))'

export const cardGridSx = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: CARD_GRID_TEMPLATE_COLUMNS,
  alignItems: 'stretch',
} as const

// docs/specs/082-poll-card-improvements.md: the polls dashboard's grid - the shared 380px floor, but
// never more than three columns. The column minimum is the larger of the shared floor and one third
// of the row after the two 16px gaps (theme spacing 2), so a fourth column can never fit however wide
// the screen: four columns would need 4m + 3 gaps <= W with m >= (W - 32px) / 3, which has no
// solution. Phone stays one column (min(380px, 100%) = 100%), and two columns still appear where two
// 380px cards fit. The other pages keep cardGridSx.
export const POLL_CARD_GRID_TEMPLATE_COLUMNS =
  'repeat(auto-fill, minmax(max(min(380px, 100%), calc((100% - 32px) / 3)), 1fr))'

export const pollCardGridSx = {
  ...cardGridSx,
  gridTemplateColumns: POLL_CARD_GRID_TEMPLATE_COLUMNS,
} as const
