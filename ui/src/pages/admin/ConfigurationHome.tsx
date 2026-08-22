import { Box, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { Card } from '../../components/Card'

interface ConfigurationCard {
  title: string
  description: string
  to: string
}

// docs/specs/007-configuration-hub-overview.md's roadmap — Products is the only
// working card today; the other three are placeholder routes (EmptyState "Coming
// soon.", registered in App.tsx) until their own specs land. Subscriptions used to
// be a card here too; promoted to its own top-level nav item (AdminHome's NAV_ITEMS)
// since it's a day-to-day billing workflow, not a system config.
const CARDS: ConfigurationCard[] = [
  { title: 'Products', description: 'Define subscription tiers, pricing, and usage limits', to: '/admin/configuration/products' },
  { title: 'Discounts & Promotions', description: 'Coupons and per-club pricing overrides', to: '/admin/configuration/discounts' },
  { title: 'Invoicing', description: 'Billing cycles and invoice history', to: '/admin/configuration/invoicing' },
  { title: 'System Settings', description: 'Platform-wide configuration', to: '/admin/configuration/settings' },
]

export default function ConfigurationHome() {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
      }}
    >
      {CARDS.map((card) => (
        <Box
          key={card.to}
          component={RouterLink}
          to={card.to}
          sx={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
        >
          <Card title={card.title}>
            <Typography variant="body2" color="text.secondary">
              {card.description}
            </Typography>
          </Card>
        </Box>
      ))}
    </Box>
  )
}
