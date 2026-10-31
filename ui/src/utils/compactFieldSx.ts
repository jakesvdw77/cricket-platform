// docs/specs/128-league-edit-revamp.md: a 36 px field (the toolbar control height) for dense edit cards. Applied through `sx` on a
// wrapper so the shared Input keeps its default size everywhere else. Type 13 px, the label rests 7 px from the top.
export const compactFieldSx = {
  '& .MuiOutlinedInput-root': { fontSize: '0.8125rem', minHeight: 36 },
  '& .MuiOutlinedInput-input': { py: '6.5px' },
  '& .MuiInputLabel-outlined:not(.MuiInputLabel-shrink)': { transform: 'translate(14px, 7px) scale(1)', fontSize: '0.8125rem' },
} as const
