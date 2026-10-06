#!/usr/bin/env node
// docs/specs/080-brand-icon-surfaces.md: removes the baked-in background rect and highlight circle from
// brand icon SVGs so BrandIcon can draw the tinted tile, and crops nav/roles/stats/actions to viewBox 24 24 208 208. Idempotent. src/icons/brand/ is never touched.
// Usage: node scripts/strip-icon-background.mjs [path-to-svg-or-directory]   (default: src/icons)
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BACKGROUND = /[ \t]*<rect\s+width="256"\s+height="256"\s+fill="#0F5132"\s*\/>[ \t]*\r?\n?/gi
const HIGHLIGHT = /[ \t]*<circle\s+cx="200"\s+cy="56"\s+r="70"\s+fill="#14633F"\s*\/>[ \t]*\r?\n?/gi

// The artwork has built-in empty margin; groups listed here are also cropped to the inner 208 box
// (24..232) so the icon fills its tile. people, field and brand keep the full 256 box.
const CROPPED_GROUPS = new Set(['nav', 'roles', 'stats', 'actions'])
const FULL_VIEWBOX = /(<svg\b[^>]*?\sviewBox=")0 0 256 256(")/i
const CROPPED_VIEWBOX = '24 24 208 208'
// A few icons draw outside the standard window, so the same 208 window is moved instead of the
// icon being shrunk or left uncropped: the Squads figures run to the bottom edge, and the
// Announce-team megaphone spans a little below 232.
const VIEWBOX_OVERRIDES = {
  'nav/squads': '24 48 208 208',
  'actions/announce-team': '24 29 208 208',
}

export function stripIconBackground(svg, group, name) {
  let out = svg.replace(BACKGROUND, '').replace(HIGHLIGHT, '')
  if (group && CROPPED_GROUPS.has(group)) {
    out = out.replace(FULL_VIEWBOX, `$1${VIEWBOX_OVERRIDES[`${group}/${name}`] ?? CROPPED_VIEWBOX}$2`)
  }
  return out
}

function collect(path, out) {
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (entry === 'brand') continue
      collect(join(path, entry), out)
    }
  } else if (path.endsWith('.svg')) {
    out.push(path)
  }
  return out
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const target = resolve(process.argv[2] ?? join(root, 'src/icons'))
  let changed = 0
  for (const file of collect(target, [])) {
    const before = readFileSync(file, 'utf8')
    const after = stripIconBackground(before, basename(dirname(file)), basename(file, '.svg'))
    if (after !== before) {
      writeFileSync(file, after)
      changed += 1
      console.log(`stripped ${relative(root, file)} (-${before.length - after.length} chars)`)
    }
  }
  console.log(`${changed} file(s) changed`)
}
