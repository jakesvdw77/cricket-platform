import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { baseTheme } from './theme'
import UpcomingMatches from './pages/view/UpcomingMatches'
import LandingPage from './pages/view/LandingPage'

const queryClient = new QueryClient()

// Root domain (vendor marketing site, docs/specs/004-landing-page.md) vs. a
// club subdomain (e.g. riverside.localhost) — window.location.hostname already
// excludes the port, so this compares cleanly against VITE_ROOT_DOMAIN.
const isRootDomain = window.location.hostname === (import.meta.env.VITE_ROOT_DOMAIN?.split(':')[0] ?? 'localhost')

function App() {
  return (
    <ThemeProvider theme={baseTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={isRootDomain ? <LandingPage /> : <UpcomingMatches />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
