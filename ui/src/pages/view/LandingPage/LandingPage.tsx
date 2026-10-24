import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Button as MuiButton, Container, Dialog, DialogContent, DialogTitle, IconButton, Typography, useMediaQuery } from '@mui/material'
import { alpha, darken } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { BrandMark } from '../../../components/BrandMark'
import { BRAND, FONT_DISPLAY, GROUND_GRADIENT, blackAlpha } from '../../../brandTokens'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import LeadCaptureForm from './LeadCaptureForm'
import FindYourClubLogin from './FindYourClubLogin'
import { BAND, DOCUMENT_TITLE, HERO, META_DESCRIPTION, OFFER, SOON, START } from './landingContent'

// docs/specs/004-landing-page.md: the public landing page in the manager look (dark green header and hero with a cricket
// scene, then the cream ground with white cards, display-face headings and a gold primary button).
const HEADER_HEIGHT = 60
const focusRing = { outline: `2px solid ${BRAND.gold}`, outlineOffset: 2 }

const goldButtonSx = {
  minHeight: 44,
  px: 2.75,
  fontWeight: 600,
  fontSize: '0.9375rem',
  textTransform: 'none',
  bgcolor: BRAND.gold,
  color: BRAND.ink900,
  border: `1px solid ${BRAND.gold}`,
  '&:hover': { bgcolor: BRAND.goldLight, borderColor: BRAND.goldLight },
  '&:focus-visible': focusRing,
} as const

const creamOutlineSx = {
  minHeight: 44,
  px: 2.75,
  fontWeight: 600,
  fontSize: '0.9375rem',
  textTransform: 'none',
  color: BRAND.cream,
  borderColor: alpha(BRAND.cream, 0.6),
  '&:hover': { borderColor: BRAND.cream, bgcolor: alpha(BRAND.cream, 0.1) },
  '&:focus-visible': focusRing,
} as const

const sectionTitleSx = {
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  fontSize: { xs: 32, sm: 40, md: 44 },
  lineHeight: 1.05,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  color: BRAND.green900,
  mb: 1,
} as const

const leadSx = { color: BRAND.inkMuted, fontSize: { xs: 17, md: 18 }, lineHeight: 1.5, maxWidth: '60ch', mb: 4 } as const

function Section({ id, children, band = false }: { id?: string; children: ReactNode; band?: boolean }) {
  return (
    <Box
      component="section"
      id={id}
      sx={{ py: { xs: 6, md: 8 }, scrollMarginTop: `${HEADER_HEIGHT}px`, ...(band && { bgcolor: BRAND.green900, color: BRAND.cream }) }}
    >
      <Container maxWidth={false} sx={{ maxWidth: 1120 }}>
        {children}
      </Container>
    </Box>
  )
}

// A flat cricket scene (sun, two hills, a pitch strip) drawn from the brand tokens only.
function HeroScene() {
  return (
    <Box
      component="svg"
      viewBox="0 0 1200 520"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      data-testid="hero-scene"
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5, pointerEvents: 'none' }}
    >
      <circle cx="980" cy="120" r="70" fill={BRAND.gold} opacity=".35" />
      <path d="M0 400 Q300 330 600 390 T1200 360 V520 H0Z" fill={BRAND.green800} opacity=".8" />
      <path d="M0 460 Q400 420 800 455 T1200 440 V520 H0Z" fill={BRAND.green700} opacity=".7" />
      <path d="M540 520 L590 430 H610 L660 520Z" fill={BRAND.sand} opacity=".5" />
    </Box>
  )
}

// Sets the page's meta description while the landing page is shown and restores the previous one.
function useMetaDescription(content: string) {
  useEffect(() => {
    let tag = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
    const created = !tag
    const previous = tag?.content
    if (!tag) {
      tag = document.createElement('meta')
      tag.name = 'description'
      document.head.appendChild(tag)
    }
    tag.content = content
    return () => {
      if (created) tag?.remove()
      else if (tag && previous !== undefined) tag.content = previous
    }
  }, [content])
}

// In-page anchors scroll smoothly, unless the visitor asks for reduced motion.
function useSmoothAnchorScroll() {
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return undefined
    const root = document.documentElement
    const previous = root.style.scrollBehavior
    root.style.scrollBehavior = 'smooth'
    return () => {
      root.style.scrollBehavior = previous
    }
  }, [])
}

export default function LandingPage() {
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const phone = useMediaQuery('(max-width:599.95px)')
  useDocumentTitle(DOCUMENT_TITLE)
  useMetaDescription(META_DESCRIPTION)
  useSmoothAnchorScroll()

  return (
    <Box sx={{ bgcolor: BRAND.groundMid, color: BRAND.ink900, overflowX: 'clip' }}>
      <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: (theme) => theme.zIndex.appBar, bgcolor: 'chrome.header', color: 'chrome.text' }}>
        <Container
          maxWidth={false}
          sx={{ maxWidth: 1120, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, height: HEADER_HEIGHT }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25 }, minWidth: 0 }}>
            <BrandMark size={34} edge />
            <Typography
              component="span"
              noWrap
              sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 18, sm: 22 }, letterSpacing: '0.05em', textTransform: 'uppercase' }}
            >
              Cricket Legend
            </Typography>
          </Box>

          <Box component="nav" aria-label="Main" sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1 }, flexShrink: 0 }}>
            {[
              { label: 'What you get', href: '#offer' },
              { label: 'On the way', href: '#soon' },
            ].map((link) => (
              <Box
                key={link.href}
                component="a"
                href={link.href}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  alignItems: 'center',
                  minHeight: 44,
                  px: 1.5,
                  borderRadius: '6px',
                  color: 'inherit',
                  textDecoration: 'none',
                  fontWeight: 500,
                  fontSize: 15,
                  '&:hover': { bgcolor: alpha(BRAND.cream, 0.1) },
                  '&:focus-visible': focusRing,
                }}
              >
                {link.label}
              </Box>
            ))}
            <MuiButton component="a" href="#lead-capture" variant="contained" sx={{ ...goldButtonSx, px: { xs: 1.5, sm: 2.75 } }}>
              Get started
            </MuiButton>
            <MuiButton variant="outlined" onClick={() => setLoginDialogOpen(true)} sx={{ ...creamOutlineSx, px: { xs: 1.5, sm: 2.75 } }}>
              Log in
            </MuiButton>
          </Box>
        </Container>
      </Box>

      {/* A dialog, not an anchor-scroll to a page section: the previous #find-your-club section sat right next to
          "Get started" and was easy to confuse with it. This makes "Log in" a single, unambiguous action every time,
          holding both the club search and the club-free admin path (docs/specs/005-admin-login.md). */}
      <Dialog
        open={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        fullWidth
        fullScreen={phone}
        maxWidth="xs"
        PaperProps={{
          sx: { borderRadius: phone ? 0 : '6px', bgcolor: 'chrome.header', backgroundImage: 'none', color: BRAND.cream, border: phone ? 0 : `1px solid ${alpha(BRAND.cream, 0.28)}` },
        }}
      >
        <DialogTitle sx={{ pr: 7, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase', color: BRAND.cream }}>
          Log in to your club
          <IconButton
            aria-label="Close"
            onClick={() => setLoginDialogOpen(false)}
            sx={{ position: 'absolute', right: 6, top: 8, width: 44, height: 44, color: BRAND.cream, '&:hover': { bgcolor: alpha(BRAND.cream, 0.1) }, '&:focus-visible': focusRing }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <FindYourClubLogin onNavigate={() => setLoginDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          color: BRAND.cream,
          background: `linear-gradient(180deg, ${BRAND.green900} 0%, ${darken(BRAND.green900, 0.3)} 100%)`,
        }}
      >
        <HeroScene />
        <Container maxWidth={false} sx={{ maxWidth: 1120, position: 'relative', pt: { xs: 7, md: 9 }, pb: { xs: 8, md: 11 } }}>
          <Typography
            component="h1"
            sx={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 'clamp(44px, 8vw, 84px)',
              lineHeight: 0.95,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              maxWidth: '14ch',
              textWrap: 'balance',
              mb: 2,
            }}
          >
            {HERO.title}
          </Typography>
          <Typography sx={{ fontSize: 'clamp(17px, 2.4vw, 21px)', lineHeight: 1.45, maxWidth: '52ch', color: alpha(BRAND.cream, 0.88), mb: 3.5 }}>
            {HERO.body}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <MuiButton component="a" href="#lead-capture" variant="contained" sx={goldButtonSx}>
              Get started
            </MuiButton>
            <MuiButton component="a" href="#offer" variant="outlined" sx={creamOutlineSx}>
              See what you get
            </MuiButton>
          </Box>
        </Container>
      </Box>

      <Box component="main" sx={{ background: GROUND_GRADIENT }}>
        <Section id="offer">
          <Typography component="h2" sx={sectionTitleSx}>
            {OFFER.title}
          </Typography>
          <Typography sx={leadSx}>{OFFER.lead}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {OFFER.cards.map((card, index) => (
              <Box
                key={card.title}
                component="article"
                sx={{ minWidth: 0, bgcolor: 'background.paper', border: `1px solid ${BRAND.cardLine}`, borderRadius: '6px', p: 3, boxShadow: `0 1px 3px ${alpha(BRAND.ink, 0.12)}` }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    mb: 1.75,
                    background: `radial-gradient(circle at 30% 25%, ${BRAND.goldLight}, ${BRAND.gold})`,
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 700,
                    fontSize: 20,
                    color: BRAND.green900,
                  }}
                >
                  {index + 1}
                </Box>
                <Typography component="h3" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: '0.04em', textTransform: 'uppercase', color: BRAND.green900, mb: 1 }}>
                  {card.title}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.25, lineHeight: 1.6, fontSize: 16, '& li + li': { mt: 0.25 } }}>
                  {card.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Section>

        <Section band>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: 4, alignItems: 'center' }}>
            <Box>
              <Typography component="span" sx={{ display: 'inline-block', fontWeight: 600, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: BRAND.gold, mb: 1.25 }}>
                {BAND.tag}
              </Typography>
              <Typography component="h2" sx={{ ...sectionTitleSx, color: BRAND.cream }}>
                {BAND.title}
              </Typography>
              <Typography sx={{ color: alpha(BRAND.cream, 0.88), fontSize: 18, lineHeight: 1.5 }}>{BAND.body}</Typography>
            </Box>
            <Box sx={{ display: 'grid', gap: 1.25 }}>
              {BAND.facts.map((fact) => (
                <Box key={fact.title} sx={{ border: `1px solid ${alpha(BRAND.cream, 0.2)}`, bgcolor: blackAlpha(0.2), borderRadius: '6px', px: 2, py: 1.75, fontSize: 16 }}>
                  <Typography component="b" sx={{ display: 'block', fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, letterSpacing: '0.05em', textTransform: 'uppercase', color: BRAND.gold }}>
                    {fact.title}
                  </Typography>
                  {fact.body}
                </Box>
              ))}
            </Box>
          </Box>
        </Section>

        <Section id="soon">
          <Typography component="h2" sx={sectionTitleSx}>
            {SOON.title}
          </Typography>
          <Typography sx={leadSx}>{SOON.lead}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
            {SOON.items.map((item) => (
              <Box key={item.title} sx={{ minWidth: 0, border: `1px dashed ${alpha(BRAND.ink900, 0.3)}`, borderRadius: '6px', px: 2.25, py: 2, bgcolor: (theme) => alpha(theme.palette.background.paper, 0.55) }}>
                <Typography component="h3" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 21, letterSpacing: '0.04em', textTransform: 'uppercase', color: BRAND.green900 }}>
                  {item.title}
                </Typography>
                <Typography sx={{ color: BRAND.inkMuted, fontSize: 15 }}>{item.body}</Typography>
              </Box>
            ))}
          </Box>
        </Section>

        <Section id="lead-capture">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, alignItems: 'start' }}>
            <Box>
              <Typography component="h2" sx={sectionTitleSx}>
                {START.title}
              </Typography>
              <Typography sx={{ ...leadSx, mb: 2 }}>{START.lead}</Typography>
              <Typography sx={{ color: BRAND.inkMuted, fontSize: 14 }}>
                Already set up? Use <b>Log in</b> at the top and find your club by name.
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0, bgcolor: 'background.paper', border: `1px solid ${BRAND.cardLine}`, borderRadius: '6px', p: 3, boxShadow: `0 1px 3px ${alpha(BRAND.ink, 0.12)}` }}>
              <LeadCaptureForm />
            </Box>
          </Box>
        </Section>
      </Box>

      <Box component="footer" sx={{ bgcolor: 'chrome.menu', color: alpha(BRAND.cream, 0.8), py: 3.5, fontSize: 14 }}>
        <Container maxWidth={false} sx={{ maxWidth: 1120, display: 'flex', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
          <span>© Cricket Legend</span>
          <span>Set up by hand for each club</span>
        </Container>
      </Box>
    </Box>
  )
}

