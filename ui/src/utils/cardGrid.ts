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
