// docs/specs/145 (Player Hub results): the pure scale and path helpers behind the Results drawings. No React, no DOM, no chart
// library; the components only turn these numbers into SVG. Kept pure so they are unit tested without rendering.

export interface RunsMixSplit {
  // Runs from fours (4 each), from sixes (6 each) and the rest (ones, twos, threes, extras off the bat).
  fours: number
  sixes: number
  rest: number
  total: number
}

// How a batting score was made. Counts below zero are treated as zero; when the boundaries add up to more than the runs (a data
// slip) the total follows the boundaries so the bar never overflows.
export function runsMixSplit(runs: number, fours: number, sixes: number): RunsMixSplit {
  const b4 = Math.max(0, fours) * 4
  const b6 = Math.max(0, sixes) * 6
  const total = Math.max(runs, b4 + b6, 0)
  return { fours: b4, sixes: b6, rest: Math.max(total - b4 - b6, 0), total }
}

// Segment widths in a bar `width` wide, in proportion to the values, with `gap` between the visible (non-zero) segments.
export function segmentWidths(values: number[], width: number, gap = 0): number[] {
  const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0)
  const visible = values.filter((value) => value > 0).length
  if (total <= 0 || width <= 0) return values.map(() => 0)
  const room = Math.max(width - gap * Math.max(visible - 1, 0), 0)
  return values.map((value) => (value > 0 ? (value / total) * room : 0))
}

// The x of each segment given its width and the gap (zero-width segments take no gap).
export function segmentOffsets(widths: number[], gap = 0): number[] {
  const offsets: number[] = []
  let x = 0
  for (const w of widths) {
    offsets.push(x)
    if (w > 0) x += w + gap
  }
  return offsets
}

export interface OverBlock {
  x: number
  width: number
  // 0 to 1: how much of the block is filled (the last, part-bowled over).
  fill: number
}

// One block per over bowled: whole overs plus a part over when the balls do not divide. At most `max` blocks are drawn (a long
// spell shrinks the blocks rather than overflowing); `max` is also the cap when the count is larger.
export function overBlocks(balls: number, ballsPerOver: number, width: number, gap = 6, max = 20): OverBlock[] {
  const perOver = ballsPerOver > 0 ? ballsPerOver : 6
  if (balls <= 0 || width <= 0) return []
  const whole = Math.floor(balls / perOver)
  const part = (balls % perOver) / perOver
  const count = Math.min(whole + (part > 0 ? 1 : 0), max)
  const blockWidth = Math.max((width - gap * (count - 1)) / count, 1)
  return Array.from({ length: count }, (_, index) => ({
    x: index * (blockWidth + gap),
    width: blockWidth,
    fill: index < whole ? 1 : part,
  }))
}

// Centres of `count` dots in a row `width` wide, `step` apart, left aligned from `radius`; a long row is squeezed to fit.
export function dotCentres(count: number, width: number, radius: number, step = radius * 2.6): number[] {
  if (count <= 0) return []
  const actual = count > 1 ? Math.min(step, (width - radius * 2) / (count - 1)) : 0
  return Array.from({ length: count }, (_, index) => radius + index * actual)
}

// A rounded-rectangle path with a different radius per corner, for a bar segment that is rounded on the outer edge only.
export function roundedRectPath(x: number, y: number, w: number, h: number, left: number, right: number): string {
  const l = Math.min(left, w / 2, h / 2)
  const r = Math.min(right, w / 2, h / 2)
  return [
    `M${x + l} ${y}`,
    `H${x + w - r}`,
    r ? `A${r} ${r} 0 0 1 ${x + w} ${y + r}` : '',
    `V${y + h - r}`,
    r ? `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` : '',
    `H${x + l}`,
    l ? `A${l} ${l} 0 0 1 ${x} ${y + h - l}` : '',
    `V${y + l}`,
    l ? `A${l} ${l} 0 0 1 ${x + l} ${y}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ')
}
