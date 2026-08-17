import { Box, Typography } from '@mui/material'

export interface FooterProps {
  productName?: string
}

export function Footer({ productName = 'Cricket Legend Platform' }: FooterProps) {
  const year = new Date().getFullYear()

  return (
    <Box component="footer" sx={{ py: 2, px: 2, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary">
        © {year} {productName}
      </Typography>
    </Box>
  )
}
