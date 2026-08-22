import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { baseTheme } from './theme'
import UpcomingMatches from './pages/view/UpcomingMatches'
import LandingPage from './pages/view/LandingPage'
import Login from './pages/view/Login'
import PostLoginRedirect from './pages/view/PostLoginRedirect'
import AdminHome from './pages/admin/AdminHome'
import AdminDashboard from './pages/admin/AdminDashboard'
import ManagerHome from './pages/manage/ManagerHome'
import ManagerDashboard from './pages/manage/ManagerDashboard'
import PlayerHome from './pages/view/PlayerHome'
import PlayerProfile from './pages/view/PlayerProfile'
import ConfigurationHome from './pages/admin/ConfigurationHome'
import ClubList from './pages/admin/ClubList'
import ClubFormPage from './pages/admin/ClubFormPage'
import ProductList from './pages/admin/ProductList'
import ProductFormPage from './pages/admin/ProductFormPage'
import SubscriptionList from './pages/admin/SubscriptionList'
import SubscriptionFormPage from './pages/admin/SubscriptionFormPage'
import EmailSettings from './pages/admin/EmailSettings'
import { EmptyState } from './components/EmptyState'

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
            {/* /login, /post-login, and /admin are club-agnostic — a platform admin's (and,
                as of docs/specs/016, a CLUB_ADMIN's) RoleAssignment has no club scope resolved
                from the URL (docs/specs/001), so these run on the root domain directly as well
                as every club subdomain, without resolving any Club. */}
            <Route path="/login" element={<Login />} />
            <Route path="/post-login" element={<PostLoginRedirect />} />

            {/* System Admin shell — docs/specs/006-post-login-home-shells.md. Dashboard is
                real (005's platform_admin identity check); every other section is a
                placeholder pending its own future spec. */}
            <Route path="/admin" element={<AdminHome />}>
              <Route index element={<AdminDashboard />} />
              <Route path="onboarding" element={<ClubList />} />
              <Route path="onboarding/new" element={<ClubFormPage />} />
              <Route path="onboarding/:id/edit" element={<ClubFormPage />} />
              <Route path="whitelisting" element={<EmptyState title="Whitelisting" description="Coming soon." />} />
              {/* Promoted out of Configuration to its own top-level item — Subscriptions is a
                  day-to-day billing workflow, not a system config an admin sets up once (that's
                  what Configuration's Products/System Settings cards are for). Was briefly
                  registered as the placeholder "Subscriptions & Invoices" at /admin/invoices. */}
              <Route path="billing" element={<SubscriptionList />} />
              <Route path="billing/new" element={<SubscriptionFormPage />} />
              <Route path="billing/:id/edit" element={<SubscriptionFormPage />} />
              <Route path="leagues" element={<EmptyState title="Leagues" description="Coming soon." />} />
              <Route path="configuration">
                <Route index element={<ConfigurationHome />} />
                <Route path="products" element={<ProductList />} />
                <Route path="products/new" element={<ProductFormPage />} />
                <Route path="products/:id/edit" element={<ProductFormPage />} />
                <Route path="email" element={<EmailSettings />} />
                <Route path="discounts" element={<EmptyState title="Discounts & Promotions" description="Coming soon." />} />
                <Route path="invoicing" element={<EmptyState title="Invoicing" description="Coming soon." />} />
                <Route path="settings" element={<EmptyState title="System Settings" description="Coming soon." />} />
              </Route>
              <Route path="profile" element={<EmptyState title="Profile" description="Coming soon." />} />
            </Route>

            {/* Club/Team Manager shell — visual scaffolding only until 001's role model
                lands (006's Non-goals); no real auth gate yet. */}
            <Route path="/manage" element={<ManagerHome />}>
              <Route index element={<ManagerDashboard />} />
              <Route path="sections" element={<EmptyState title="Sections & Age Groups" description="Coming soon." />} />
              <Route path="teams" element={<EmptyState title="Teams" description="Coming soon." />} />
              <Route path="players" element={<EmptyState title="Players" description="Coming soon." />} />
              <Route path="fixtures" element={<EmptyState title="Fixtures & Results" description="Coming soon." />} />
              <Route
                path="permissions"
                element={<EmptyState title="Team Managers & Permissions" description="Coming soon." />}
              />
              <Route path="squads" element={<EmptyState title="Squads" description="Coming soon." />} />
              <Route path="communication" element={<EmptyState title="Communication" description="Coming soon." />} />
              <Route path="availability" element={<EmptyState title="Availability Polls" description="Coming soon." />} />
              <Route path="profile" element={<EmptyState title="Profile" description="Coming soon." />} />
            </Route>

            {/* Player shell — mobile-first bottom tabs; same no-real-auth-yet caveat as
                Manager above. */}
            <Route path="/player" element={<PlayerHome />}>
              <Route index element={<EmptyState title="Fixtures" description="Coming soon." />} />
              <Route path="results" element={<EmptyState title="Results" description="Coming soon." />} />
              <Route path="availability" element={<EmptyState title="Availability" description="Coming soon." />} />
              <Route path="profile" element={<PlayerProfile />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
