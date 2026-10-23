import { Box, Typography } from '@mui/material'

export interface FooterProps {
  productName?: string
}

export function Footer({ productName = 'Cricket Legend Platform' }: FooterProps) {
  const year = new Date().getFullYear()

  return (
    // docs/specs/120: the dark platform chrome, the same for every club (cream 12 px text, no top border).
    <Box component="footer" sx={{ py: 2, px: 2, textAlign: 'center', bgcolor: 'chrome.header', color: 'chrome.text' }}>
      <Typography variant="caption" color="inherit" sx={{ fontSize: 12 }}>
        © {year} {productName}
      </Typography>
    </Box>
  )
}
