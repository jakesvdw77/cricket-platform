import { useRef } from 'react'
import { Box, Slider, ToggleButton, Typography } from '@mui/material'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { ShareControlGroup } from '../ShareCore'
import { PICTURE_FILTERS } from '../../utils/share/matchImage'
import type { PictureFilter } from '../../utils/share/matchImage'
import type { MatchPictureState } from './matchScreenTypes'

interface Props {
  picture: MatchPictureState
  include: boolean
  onIncludeChange: (next: boolean) => void
}

// docs/specs/131 (Team selection poster, Picture): Choose picture, Remove, Position X and Y, Zoom, Opacity and the filter
// chips. The picture is read in the browser only; nothing is uploaded.
export function MatchPictureControls({ picture, include, onIncludeChange }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const { settings } = picture
  const slider = (label: string, value: number, min: number, max: number, step: number, key: 'x' | 'y' | 'zoom' | 'opacity') => (
    <Box sx={{ width: '100%', px: 0.5 }}>
      <Typography id={`match-picture-${key}`} variant="caption" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Slider
        size="small"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={!picture.image || !include}
        aria-labelledby={`match-picture-${key}`}
        onChange={(_event, next) => picture.setSettings({ [key]: next as number })}
      />
    </Box>
  )
  return (
    <ShareControlGroup label="Picture">
      <CompactSwitch label="Picture" checked={include} onChange={onIncludeChange} />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button size="compact" variant="secondary" startIcon={<UploadFileOutlinedIcon />} onClick={() => input.current?.click()}>
          Choose Picture
        </Button>
        <Button size="compact" variant="ghost" disabled={!picture.image} onClick={picture.remove}>
          Remove
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          aria-label="Choose picture file"
          data-testid="match-picture-input"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) picture.choose(file)
            event.target.value = ''
          }}
        />
      </Box>
      <Typography variant="caption" color={picture.error ? 'error' : 'text.secondary'} role="status">
        {picture.error ?? (picture.name ? `${picture.name}. Used on this poster only, never uploaded.` : 'No picture chosen: a club colour panel is used.')}
      </Typography>
      {slider('Position X', settings.x, 0, 1, 0.01, 'x')}
      {slider('Position Y', settings.y, 0, 1, 0.01, 'y')}
      {slider('Zoom', settings.zoom, 1, 3, 0.05, 'zoom')}
      {slider('Opacity', settings.opacity, 0.2, 1, 0.01, 'opacity')}
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        Filter
      </Typography>
      <CompactToggleGroup value={settings.filter} ariaLabel="Filter" fullWidthOnPhone onChange={(next: PictureFilter) => picture.setSettings({ filter: next })}>
        {PICTURE_FILTERS.map((item) => (
          <ToggleButton key={item.value} value={item.value} disabled={!picture.image}>
            {item.label}
          </ToggleButton>
        ))}
      </CompactToggleGroup>
    </ShareControlGroup>
  )
}
