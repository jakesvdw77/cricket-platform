import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { IconButton, MenuItem, Stack, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import { Input } from '../Input'
import { Button } from '../Button'
import type { SocialLink, SocialPlatform } from '../marketing/SocialLinksRow'

// Generic SocialLink[] editor — the reusable counterpart to SocialLinksRow's read-only display
// (docs/specs/022-club-social-media.md). Deliberately has no knowledge of ClubProfile: the next
// two specs in the mini-epic (Sponsors, Sponsor Contacts) reuse this component unchanged.
export interface SocialLinksFieldsProps {
  value: SocialLink[]
  onChange: (links: SocialLink[]) => void
}

// Same 10 "popular platform" values SocialLinksRow recognizes — offered in the per-row Select
// alongside a trailing "Custom…" option. Kept local to this component (rather than exported from
// SocialLinksRow) since it's SocialLinksFields' own editing concern, not a display one.
const KNOWN_PLATFORMS: SocialPlatform[] = [
  'facebook',
  'instagram',
  'x',
  'tiktok',
  'youtube',
  'linkedin',
  'whatsapp',
  'threads',
  'pinterest',
  'snapchat',
]

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  threads: 'Threads',
  pinterest: 'Pinterest',
  snapchat: 'Snapchat',
}

// Sentinel Select value for the trailing "Custom…" option — never a real platform string, so it
// can't collide with a club-typed custom label (however unlikely) or a known platform value.
const CUSTOM_OPTION = '__custom__'

// Mirrors SocialLinkDto's backend @Pattern(regexp = "^https?://.+") — same regex ClubForm's own
// WEBSITE_PATTERN validates the club's website field against.
const WEBSITE_PATTERN = /^https?:\/\/.+/i

function isKnownPlatform(platform: string): platform is SocialPlatform {
  return (KNOWN_PLATFORMS as string[]).includes(platform)
}

// First SocialPlatform not already present in `links`, or null once all 10 are used — callers
// fall back to "Custom…" mode in the null case.
function firstUnusedPlatform(links: SocialLink[]): SocialPlatform | null {
  const used = new Set(links.map((link) => link.platform))
  return KNOWN_PLATFORMS.find((platform) => !used.has(platform)) ?? null
}

interface RowUiState {
  // Whether this row is in "type your own platform label" mode. Local, transient UI state only —
  // the row's real platform string always lives in `value`/`onChange`, never here. Tracked
  // explicitly (rather than derived from the platform string on every render) so a row stays in
  // custom mode while its label is blank or happens to type out a known platform's name.
  isCustom: boolean
}

function deriveInitialRowState(link: SocialLink): RowUiState {
  return { isCustom: !isKnownPlatform(link.platform) }
}

export function SocialLinksFields({ value, onChange }: SocialLinksFieldsProps) {
  const [rowState, setRowState] = useState<RowUiState[]>(() => value.map(deriveInitialRowState))

  const handleAdd = () => {
    const next = firstUnusedPlatform(value)
    onChange([...value, { platform: next ?? '', url: '' }])
    setRowState((prev) => [...prev, { isCustom: next === null }])
  }

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
    setRowState((prev) => prev.filter((_, i) => i !== index))
  }

  const handlePlatformSelectChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.value
    if (selected === CUSTOM_OPTION) {
      setRowState((prev) => prev.map((row, i) => (i === index ? { isCustom: true } : row)))
      onChange(value.map((link, i) => (i === index ? { ...link, platform: '' } : link)))
      return
    }
    onChange(value.map((link, i) => (i === index ? { ...link, platform: selected as SocialPlatform } : link)))
  }

  const handleCustomPlatformChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange(value.map((link, i) => (i === index ? { ...link, platform: event.target.value } : link)))
  }

  const handleUrlChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange(value.map((link, i) => (i === index ? { ...link, url: event.target.value } : link)))
  }

  // Client-side mirror of the backend's composite-key ("at most one row per platform string")
  // and @NotBlank checks — surfaced per-row rather than as a single form-wide error, same
  // "inline error near the field" precedent every other form component in this codebase uses.
  const platformCounts = value.reduce<Record<string, number>>((counts, link) => {
    const key = link.platform.trim()
    if (key) {
      counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }, {})

  return (
    <Stack spacing={2}>
      {value.map((link, index) => {
        const isCustom = rowState[index]?.isCustom ?? !isKnownPlatform(link.platform)
        const platformTrimmed = link.platform.trim()
        const platformError = !platformTrimmed
          ? 'Platform is required'
          : platformCounts[platformTrimmed] > 1
            ? 'This platform has already been added'
            : undefined
        const urlTrimmed = link.url.trim()
        const urlError = !urlTrimmed
          ? 'URL is required'
          : !WEBSITE_PATTERN.test(urlTrimmed)
            ? 'Enter a valid URL, e.g. https://example.com'
            : undefined

        // Every known platform not already used by a *different* row, plus this row's own
        // current selection (if it's a known one) so it stays visible/selected in its own Select.
        const usedByOtherRows = new Set(value.filter((_, i) => i !== index).map((l) => l.platform))
        const availablePlatforms = KNOWN_PLATFORMS.filter(
          (platform) => platform === link.platform || !usedByOtherRows.has(platform),
        )

        return (
          <Stack
            key={index}
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', md: 'flex-start' }}
          >
            {isCustom ? (
              <Input
                label="Platform"
                placeholder="e.g. Discord"
                value={link.platform}
                onChange={handleCustomPlatformChange(index)}
                error={Boolean(platformError)}
                helperText={platformError}
              />
            ) : (
              <Input
                select
                label="Platform"
                value={link.platform}
                onChange={handlePlatformSelectChange(index)}
                error={Boolean(platformError)}
                helperText={platformError}
              >
                {availablePlatforms.map((platform) => (
                  <MenuItem key={platform} value={platform}>
                    {PLATFORM_LABELS[platform]}
                  </MenuItem>
                ))}
                <MenuItem value={CUSTOM_OPTION}>Custom…</MenuItem>
              </Input>
            )}
            <Input
              label="URL"
              type="url"
              value={link.url}
              onChange={handleUrlChange(index)}
              error={Boolean(urlError)}
              helperText={urlError ?? 'e.g. https://example.com'}
            />
            <IconButton
              aria-label={`Remove ${platformTrimmed || 'link'}`}
              onClick={() => handleRemove(index)}
              sx={{ mt: { xs: 0, md: 1 } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        )
      })}

      {value.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No social links added yet.
        </Typography>
      )}

      <Button variant="secondary" size="sm" startIcon={<AddIcon />} onClick={handleAdd} sx={{ alignSelf: 'flex-start' }}>
        Add link
      </Button>
    </Stack>
  )
}
