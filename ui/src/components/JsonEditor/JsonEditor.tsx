import { useId } from 'react'
import Editor from 'react-simple-code-editor'
import Prism from 'prismjs'
import 'prismjs/components/prism-json'
import { Box } from '@mui/material'
import { visuallyHidden } from '@mui/utils'

export interface JsonEditorProps {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
  disabled?: boolean
  error?: boolean
  // Starting height in lines. The box scrolls inside and the user can drag its bottom edge to make it taller or shorter.
  rows?: number
}

const LINE_HEIGHT = 1.5
const FONT_SIZE = 12
const PADDING = 12

function highlight(code: string): string {
  return Prism.highlight(code, Prism.languages.json, 'json')
}

// A paste box that colours JSON as it is typed (docs/specs/104-match-results-import-adaptors.md, the JSON source): a
// thin wrapper over react-simple-code-editor with Prism's JSON grammar. The text is still a plain textarea underneath, so
// paste, undo and the screen reader's field name work as in any text box. The colours are theme tokens, never hex.
export function JsonEditor({ value, onChange, ariaLabel, placeholder, disabled = false, error = false, rows = 12 }: JsonEditorProps) {
  const lineHeightPx = FONT_SIZE * LINE_HEIGHT
  const textareaId = useId()
  return (
    <Box
      sx={(theme) => ({
        border: 1,
        borderColor: error ? 'error.main' : 'divider',
        borderRadius: 1,
        bgcolor: disabled ? 'action.disabledBackground' : 'background.paper',
        height: rows * lineHeightPx + PADDING * 2,
        minHeight: 4 * lineHeightPx + PADDING * 2,
        overflow: 'auto',
        resize: 'vertical',
        '&:hover': disabled || error ? undefined : { borderColor: 'text.primary' },
        '&:focus-within': { borderColor: error ? 'error.main' : 'primary.main', outline: `1px solid ${error ? theme.palette.error.main : theme.palette.primary.main}` },
        '& .token.property': { color: 'primary.main', fontWeight: 600 },
        '& .token.string': { color: 'success.dark' },
        '& .token.number': { color: 'info.main' },
        '& .token.boolean, & .token.null': { color: 'warning.dark' },
        '& .token.punctuation, & .token.operator': { color: 'text.secondary' },
        '& textarea::placeholder': { color: 'text.disabled' },
      })}
    >
      {/* The editor puts extra props on its outer div, so the textarea is named with a real label. */}
      <Box component="label" htmlFor={textareaId} sx={visuallyHidden}>
        {ariaLabel}
      </Box>
      <Editor
        textareaId={textareaId}
        value={value}
        onValueChange={onChange}
        highlight={highlight}
        padding={PADDING}
        disabled={disabled}
        placeholder={placeholder}
        style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT, minHeight: '100%' }}
      />
    </Box>
  )
}
