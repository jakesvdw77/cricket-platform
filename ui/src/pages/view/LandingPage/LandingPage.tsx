import { AppBar, Box, Container, Stack, Toolbar, Typography } from '@mui/material'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { TestimonialCard } from '../../../components/marketing/TestimonialCard'
import { SocialLinksRow } from '../../../components/marketing/SocialLinksRow'
import LeadCaptureForm from './LeadCaptureForm'
import FindYourClubLogin from './FindYourClubLogin'

const NAV_LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'Testimonials', href: '#testimonials' },
]

const FEATURE_TILES = [
  {
    title: 'Section-scoped scoring',
    body: 'Every section — seniors, juniors, veterans — sees only the fixtures and scorecards that belong to it, without extra admin overhead.',
  },
  {
    title: 'One codebase, your brand',
    body: 'Your club gets its own subdomain and colours, white-labelled from a single platform we maintain for every club.',
  },
  {
    title: 'Vendor-assisted onboarding',
    body: "We set your club up by hand — no fumbling through a generic signup wizard. Tell us you're interested and we take it from there.",
  },
]

const SOCIAL_LINKS = [
  { platform: 'facebook' as const, url: 'https://facebook.com' },
  { platform: 'instagram' as const, url: 'https://instagram.com' },
  { platform: 'x' as const, url: 'https://x.com' },
  { platform: 'linkedin' as const, url: 'https://linkedin.com' },
]

export default function LandingPage() {
  return (
    <Box>
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" component="span" sx={{ fontWeight: 700, flexGrow: 1 }}>
            Cricket Legend
          </Typography>

          <Stack
            direction="row"
            spacing={3}
            sx={{ display: { xs: 'none', md: 'flex' }, mr: 2 }}
            component="nav"
            aria-label="Page sections"
          >
            {NAV_LINKS.map((link) => (
              <Typography
                key={link.href}
                component="a"
                href={link.href}
                variant="body2"
                sx={{ color: 'text.primary', textDecoration: 'none', fontWeight: 500 }}
              >
                {link.label}
              </Typography>
            ))}
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button component="a" href="#find-your-club" variant="secondary" size="sm">
              Log in
            </Button>
            <Button component="a" href="#lead-capture" variant="primary" size="sm">
              Get started
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }} id="product">
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Cricket club management, built for how clubs actually run
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 640 }}>
          Fixtures, scorecards, and membership for every section of your club — white-labelled to your
          colours, hosted on your own subdomain.
        </Typography>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          {FEATURE_TILES.map((tile) => (
            <Card key={tile.title} title={tile.title} sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {tile.body}
              </Typography>
            </Card>
          ))}
        </Stack>
      </Container>

      <Box sx={{ bgcolor: 'action.hover', borderTop: 1, borderBottom: 1, borderColor: 'divider' }} id="testimonials">
        <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 3 }}>
            Clubs already using the platform
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TestimonialCard
              quote="Onboarding our club took one afternoon instead of the two weeks we budgeted for. The section admins were self-sufficient within a day."
              name="Riaan Coetzee"
              role="Chairman, Riverside CC"
            />
            <TestimonialCard
              quote="Every section sees exactly the fixtures relevant to them, nothing else."
              name="Devan Pillay"
              role="Juniors Convenor, Oakfield CC"
            />
            <TestimonialCard
              quote="Finally a scoring app that works on a phone in bright sunlight."
              name="Sarah Mokoena"
              role="Fixtures Secretary, Colts CC"
              avatarUrl="https://i.pravatar.cc/72?img=47"
            />
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="sm" sx={{ py: { xs: 5, md: 8 } }} id="lead-capture">
        <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
          Get started
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Tell us about your club and we'll be in touch — no account created, no commitment.
        </Typography>
        <LeadCaptureForm />
      </Container>

      <Box sx={{ bgcolor: 'action.hover', borderTop: 1, borderColor: 'divider' }} id="find-your-club">
        <Container maxWidth="sm" sx={{ py: { xs: 5, md: 8 } }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
            Log in to your club
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Find your club below to be taken to its own login page.
          </Typography>
          <FindYourClubLogin />
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider' }}>
        <Container
          maxWidth="md"
          sx={{
            py: 3,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            © {new Date().getFullYear()} Cricket Legend. All rights reserved.
          </Typography>
          <SocialLinksRow links={SOCIAL_LINKS} />
        </Container>
      </Box>
    </Box>
  )
}
