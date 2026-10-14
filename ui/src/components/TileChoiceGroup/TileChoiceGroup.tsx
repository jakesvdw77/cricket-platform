import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Box, ButtonBase } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { alpha } from '@mui/material/styles'

export interface TileChoiceOption<T extends string> {
  value: T
  // What the tile shows; its text is the radio's accessible name.
  content: ReactNode
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
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0

  const move = (index: number) => {
    const target = (index + options.length) % options.length
    refs.current[target]?.focus()
    onChange(options[target].value)
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') move(index + 1)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') move(index - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(options.length - 1)
    else return
    event.preventDefault()
  }

  return (
    <Box role="radiogroup" aria-label={label} sx={{ display: 'grid', gridTemplateColumns: columns, gap: 1 }}>
      {options.map((option, index) => {
        const selected = index === selectedIndex
        return (
          <ButtonBase
            key={option.value}
            ref={(node: HTMLButtonElement | null) => {
              refs.current[index] = node
            }}
            role="radio"
            aria-checked={selected}
            tabIndex={index === tabStop ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            sx={[
              (theme) => ({
                display: 'flex',
                px: 1.5,
                borderRadius: 1,
                border: 2,
                borderColor: selected ? 'primary.main' : 'divider',
                bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'background.paper',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
              }),
              ...(Array.isArray(tileSx) ? tileSx : tileSx ? [tileSx] : []),
            ]}
          >
            {option.content}
          </ButtonBase>
        )
      })}
    </Box>
  )
}
