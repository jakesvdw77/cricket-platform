import { BRAND } from '../../brandTokens'

// The one cricket ball drawing (an SVG group) shared by CricketBallLoader and the StatusScreen illustrations so they cannot
// drift: leather, a straight darker ridge through the centre and a straight row of stitches either side, seen face on.
export function BallArt({ cx = 32, cy = 32, r = 30, fill = BRAND.ballRed }: { cx?: number; cy?: number; r?: number; fill?: string }) {
  const offset = r * 0.16
  const half = (d: number) => Math.sqrt(r * r - d * d) * 0.9
  return (
    <g data-testid="ball-art">
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      <line x1={cx} y1={cy - half(0)} x2={cx} y2={cy + half(0)} stroke={BRAND.ballRedShade} strokeWidth={Math.max(1.5, r * 0.07)} strokeLinecap="round" data-testid="ball-ridge" />
      {[-offset, offset].map((d) => (
        <line key={d} x1={cx + d} y1={cy - half(d)} x2={cx + d} y2={cy + half(d)} stroke={BRAND.ballSeam} strokeWidth={Math.max(1.2, r * 0.055)} strokeDasharray={`${r * 0.1} ${r * 0.09}`} strokeLinecap="round" data-testid="ball-stitches" />
      ))}
      <ellipse cx={cx - r * 0.35} cy={cy - r * 0.4} rx={r * 0.25} ry={r * 0.16} fill={BRAND.cream} opacity="0.2" transform={`rotate(-30 ${cx - r * 0.35} ${cy - r * 0.4})`} />
    </g>
  )
}
