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

// docs/standards/page-anatomy.md section 6: an opt-in grid that fills the row. auto-fit with a 340px floor stretches the tracks (and so the
// cards) to share the width with no empty slot at the right; each card is capped at 560px (left aligned) so one or two cards never become
// giant bars; the min() keeps a phone to one column. Used by the Leagues list first.
export const DYNAMIC_CARD_GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))'
export const DYNAMIC_CARD_MAX_WIDTH = 560

export const dynamicCardGridSx = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: DYNAMIC_CARD_GRID_TEMPLATE_COLUMNS,
  alignItems: 'stretch',
  '& > *': { maxWidth: DYNAMIC_CARD_MAX_WIDTH, width: '100%', justifySelf: 'start' },
  // With only a few cards the grid itself is no wider than that many capped cards, so the tracks never outgrow the cap and no gap opens
  // between a card and the dashed Add card (1 child: the Add card alone; 2: one card and Add; and so on).
  '&:has(> :last-child:nth-child(1))': { maxWidth: DYNAMIC_CARD_MAX_WIDTH },
  '&:has(> :last-child:nth-child(2))': { maxWidth: 2 * DYNAMIC_CARD_MAX_WIDTH + 16 },
  '&:has(> :last-child:nth-child(3))': { maxWidth: 3 * DYNAMIC_CARD_MAX_WIDTH + 32 },
} as const
