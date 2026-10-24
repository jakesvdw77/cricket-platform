import { Box } from '@mui/material'
import { BRAND } from '../../brandTokens'
import { BallArt } from '../CricketBallLoader'
import type { StatusKind } from './StatusScreen'

// Small inline illustrations (flat, brand palette, decoration only) for the StatusScreen kinds.
const W = 160
const H = 110

function Ground() {
  return <ellipse cx="80" cy="98" rx="62" ry="7" fill={BRAND.ink} opacity="0.55" />
}

function Stumps({ bailOff }: { bailOff?: boolean }) {
  return (
    <>
      <Ground />
      {[62, 80, 98].map((x) => (
        <rect key={x} x={x - 2.5} y="32" width="5" height="64" rx="2" fill={BRAND.sand} />
      ))}
      {bailOff ? (
        <>
          <rect x="60" y="24" width="18" height="4" rx="2" fill={BRAND.gold} transform="rotate(-24 69 26) translate(-8 -14)" />
          <rect x="84" y="28" width="18" height="4" rx="2" fill={BRAND.gold} transform="rotate(18 93 30) translate(14 -10)" />
        </>
      ) : (
        <>
          <rect x="60" y="28" width="18" height="4" rx="2" fill={BRAND.gold} />
          <rect x="82" y="28" width="18" height="4" rx="2" fill={BRAND.gold} />
        </>
      )}
    </>
  )
}

function Ball() {
  return <BallArt cx={80} cy={62} r={22} />
}

function Rain() {
  return (
    <>
      <Ground />
      <g fill={BRAND.cream}>
        <circle cx="62" cy="40" r="16" opacity="0.92" />
        <circle cx="82" cy="34" r="20" opacity="0.92" />
        <circle cx="102" cy="42" r="15" opacity="0.92" />
        <rect x="60" y="40" width="44" height="16" rx="8" opacity="0.92" />
      </g>
      {[64, 78, 92, 106].map((x, i) => (
        <line key={x} x1={x} y1={64 + (i % 2) * 6} x2={x - 4} y2={78 + (i % 2) * 6} stroke={BRAND.sand} strokeWidth="2.4" strokeLinecap="round" />
      ))}
      <rect x="74" y="84" width="3" height="14" rx="1" fill={BRAND.sand} />
      <rect x="80" y="84" width="3" height="14" rx="1" fill={BRAND.sand} />
      <rect x="86" y="84" width="3" height="14" rx="1" fill={BRAND.sand} />
    </>
  )
}

function Pavilion() {
  return (
    <>
      <Ground />
      <rect x="36" y="48" width="88" height="48" fill={BRAND.cream} opacity="0.95" />
      <polygon points="30,50 80,22 130,50" fill={BRAND.gold} />
      <rect x="70" y="66" width="20" height="30" fill={BRAND.green900} />
      <rect x="44" y="60" width="16" height="14" fill={BRAND.green800} />
      <rect x="100" y="60" width="16" height="14" fill={BRAND.green800} />
      <line x1="80" y1="22" x2="80" y2="8" stroke={BRAND.sand} strokeWidth="2" />
      <polygon points="80,8 94,12 80,16" fill={BRAND.ballRed} />
    </>
  )
}

function Pad() {
  return (
    <>
      <Ground />
      <rect x="56" y="30" width="48" height="64" rx="12" fill={BRAND.cream} />
      <rect x="64" y="42" width="32" height="12" rx="3" fill={BRAND.gold} />
      <rect x="64" y="60" width="32" height="12" rx="3" fill={BRAND.gold} />
      <rect x="64" y="78" width="32" height="8" rx="3" fill={BRAND.gold} />
    </>
  )
}

export function StatusIllustration({ kind }: { kind: StatusKind }) {
  let art
  switch (kind) {
    case 'not-authorised':
      art = <Stumps bailOff />
      break
    case 'signed-out':
      art = <Stumps />
      break
    case 'suspended':
      art = <Pad />
      break
    case 'session-expired':
      art = <Stumps bailOff />
      break
    case 'not-found':
      art = <Pavilion />
      break
    case 'unreachable':
      art = <Rain />
      break
    default:
      art = (
        <>
          <Ground />
          <Ball />
        </>
      )
  }
  return (
    <Box component="svg" aria-hidden data-testid="status-illustration" data-kind={kind} viewBox={`0 0 ${W} ${H}`} sx={{ width: { xs: 136, sm: 176 }, height: 'auto', display: 'block' }}>
      {art}
    </Box>
  )
}
