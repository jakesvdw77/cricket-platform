import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Box, ButtonBase } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { alpha } from '@mui/material/styles'

export interface TileChoiceOption<T extends string> {
  value: T
  // What the tile shows; its text is the radio's accessible name.
  content: ReactNode
  // docs/specs/104: this one tile cannot be chosen (a match that is already published): drawn quiet, skipped by the arrow
  // keys. The rest of the group works as usual.
  disabled?: boolean
  // docs/specs/109-delete-empty-match.md: a control drawn over the tile's bottom-right corner but outside the radio (so it
  // is not part of the radio's accessible name, a click on it never chooses the tile, and a button never nests in a button).
  // The tile gets extra bottom padding to make room for it.
  adornment?: ReactNode
}

export interface TileChoiceGroupProps<T extends string> {
  // Accessible name of the group ("Who won?").
  label: string
  options: TileChoiceOption<T>[]
  value: T | null
  onChange: (value: T) => void
  disabled?: boolean
  // CSS grid-template-columns, responsive object allowed.
  columns: string | Record<string, string>
  // Extra styling for each tile (min height, content direction).
  tileSx?: SxProps<Theme>
}

// A single-choice group of large tiles: a radiogroup with a roving tab stop (Tab lands on the chosen tile, or the first
// one when nothing is chosen) and arrow keys that move and choose, Home and End jumping to the ends. Shared by the result
// wizard's outcome tiles and side pickers.
export function TileChoiceGroup<T extends string>({ label, options, value, onChange, disabled = false, columns, tileSx }: TileChoiceGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = options.findIndex((option) => option.value === value)
  const firstEnabled = Math.max(0, options.findIndex((option) => !option.disabled))
  const tabStop = selectedIndex >= 0 ? selectedIndex : firstEnabled

  // Moves to the nearest tile in `step` direction that can be chosen (the same tile when none other can).
  const move = (index: number, step: 1 | -1 = 1) => {
    let target = (index + options.length) % options.length
    for (let tried = 0; tried < options.length && options[target].disabled; tried += 1) {
      target = (target + step + options.length) % options.length
    }
    if (options[target].disabled) return
    refs.current[target]?.focus()
    onChange(options[target].value)
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') move(index + 1, 1)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') move(index - 1, -1)
    else if (event.key === 'Home') move(0, 1)
    else if (event.key === 'End') move(options.length - 1, -1)
    else return
    event.preventDefault()
  }

  return (
    <Box role="radiogroup" aria-label={label} sx={{ display: 'grid', gridTemplateColumns: columns, gap: 1 }}>
      {options.map((option, index) => {
        const selected = index === selectedIndex
        const tile = (
          <ButtonBase
            key={option.value}
            ref={(node: HTMLButtonElement | null) => {
              refs.current[index] = node
            }}
            role="radio"
            aria-checked={selected}
            tabIndex={index === tabStop ? 0 : -1}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            sx={[
              option.adornment ? { width: '100%' } : {},
              (theme) => ({
                display: 'flex',
                px: 1.5,
                borderRadius: 1,
                border: 2,
                borderColor: selected ? 'primary.main' : 'divider',
                bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'background.paper',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                ...(option.disabled ? { opacity: 0.6, bgcolor: theme.palette.action.hover } : {}),
              }),
              ...(Array.isArray(tileSx) ? tileSx : tileSx ? [tileSx] : []),
              // Room under the content for the adornment (a 44 px target), applied last so it wins over tileSx.
              option.adornment ? { pb: 6.5 } : {},
            ]}
          >
            {option.content}
          </ButtonBase>
        )
        if (!option.adornment) return tile
        return (
          <Box key={option.value} sx={{ position: 'relative', display: 'grid' }}>
            {tile}
            {/* Each adornment adds one Tab stop between the radios (they are not part of the roving tab stop). */}
            <Box role="presentation" sx={{ position: 'absolute', right: 8, bottom: 4 }}>
              {option.adornment}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
