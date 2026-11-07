import { STATS_COLOUR } from '../../../../brandTokens'

// docs/specs/147 Amendment 2 item 16 (intelligent colour): the slice colour of each dismissal type. Pure, no React. For a batter, being out
// is bad (soft coral and warm shades, distinguishable by lightness as well as hue) and not out is good; for a bowler every wicket type is
// good (greens and the blue). An unknown type falls back to grey. The labels and counts always sit beside the colour.
export const BATTER_DISMISSAL_COLOUR: Record<string, string> = {
  NOT_OUT: STATS_COLOUR.good,
  RETIRED_NOT_OUT: STATS_COLOUR.good,
  BOWLED: STATS_COLOUR.bad,
  CAUGHT: STATS_COLOUR.warm,
  CAUGHT_AND_BOWLED: STATS_COLOUR.clay,
  LBW: STATS_COLOUR.badDeep,
  STUMPED: STATS_COLOUR.rose,
  RUN_OUT: STATS_COLOUR.amber,
  HIT_WICKET: STATS_COLOUR.roseDeep,
  HANDLED_BALL: STATS_COLOUR.neutralGrey,
  OBSTRUCTING_FIELD: STATS_COLOUR.neutralGrey,
  HIT_BALL_TWICE: STATS_COLOUR.neutralGrey,
  TIMED_OUT: STATS_COLOUR.neutralGrey,
  RETIRED_OUT: STATS_COLOUR.neutralGrey,
  OTHER: STATS_COLOUR.neutralGrey,
}

export const BOWLER_WICKET_COLOUR: Record<string, string> = {
  BOWLED: STATS_COLOUR.good,
  CAUGHT: STATS_COLOUR.goodSoft,
  CAUGHT_AND_BOWLED: STATS_COLOUR.goodSoft,
  LBW: STATS_COLOUR.wicketBlue,
  STUMPED: STATS_COLOUR.amber,
  HIT_WICKET: STATS_COLOUR.amber,
  NOT_ITEMISED: STATS_COLOUR.neutralGrey,
}

export const batterDismissalColour = (type: string): string => BATTER_DISMISSAL_COLOUR[type] ?? STATS_COLOUR.neutralGrey
export const bowlerWicketColour = (type: string): string => BOWLER_WICKET_COLOUR[type] ?? STATS_COLOUR.neutralGrey
