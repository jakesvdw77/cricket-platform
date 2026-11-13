# 149: Account Sign-Up and Club Entry Flow (beta)

**Depends on:** `001-tenancy-identity-model.md` (`Person` is one global identity, `Club.slug`, `ClubStatus`), `002-realm-subdomain-auth.md` (one shared realm, one SPA client for every host, the redirect always same-origin; **ADR-03's wildcard redirect URI is dead on Keycloak 24.0.3 and replaced by per-club registration, which this spec relies on and does not change**), `003-club-onboarding.md` (club subdomains, `Club.status`; its `Invitation` entity and `GET /invitations/{token}` were never built, so there is no token invitation link today), `004-landing-page.md` (the Log in dialog, `GET /api/v1/public/clubs`), `005-admin-login.md` (the platform admin path, unchanged here), `016-keycloak-account-provisioning.md` (`KeycloakProvisioningService`, `registerClubRedirectAccess`, the manager invite, `bridgeByEmail`, `email_verified`), `119-login-account-journey.md` (Parts 1 to 3 and Decisions 2 to 4, 7, 15, 16, 19, 24, 28, 29 and 31: agents, main agent, link requests, invitations, masked contact, `POST /me/register`, `GET /me/player-matches`, `POST /me/links`, `/me/link-requests`, `GET /me/clubs`, `MeServiceImpl.register`, `PostLoginRedirect`, `FindYourPlayersPage` at `/welcome`, `ProfileChooserPage`, `MyPlayersPage`; its mockups and slices are built, this spec changes none of its decisions), `121-player-hub-menu-and-fields.md` and `135-player-hub-match-view.md` (only for the Hub frame and the Hub copy rule), `docs/deployment.md` ("Login theme and realm checklist", "Google sign-in", "Valid Redirect URIs & Web Origins"), `keycloak/README.md`, `docs/standards/*.md`.
**Status:** draft. Requested by the owner 2026-11-13 ("specify the flow properly when using the proper club and general page", ahead of a beta on a server). Written 2026-11-13 against the code on branch `feat/sign-up-link`.

## Problem & Goals

A parent, guardian or adult player can already create an account (Keycloak registration at `/register`, or Continue With Google) and then find their players on `/welcome`. Two things make that unsafe to put in front of beta testers. First, the club the visitor chose or came from is dropped on the way: the Log in dialog's Create Account and Continue With Google go to the root domain, so the person is asked for the club again on Find Your Players, and nothing says what happens to the club across the email-verification round trip or the Google broker. Second, reading the code for this spec found paths that dead-end for exactly the beta audience (see "Findings"): a registered but unlinked account that signs in a second time lands on "Not authorized" at `/admin`, and a Keycloak "Back to application" link to `/post-login` with no pending login does the same.

This spec fixes the flow end to end and writes it down per entry point, and it adds the beta deployment checklist the owner needs to stand the platform up on a real server (a real domain, wildcard DNS and TLS, a realm with registration, verification and Google switched on).

Goals:
- **A. One rule for the club context:** the club a person came from is the host they are on. It is carried by the address (the redirect URI), is never stored, never signed, never trusted for access, and only preselects things (Decision 2).
- **B. Every entry route works and is specified:** club address (`/login`, `/register`, `?idp=google`, the agent invitation and outcome email links, share links), and the general landing page (the Log in dialog with the club chosen, with no club, Platform admin).
- **C. A new, unlinked account has a defined home** on a club address and on the root domain, with a "Welcome to <Club>" line, the club preselected where it is known, and never a dead end.
- **D. Every failure has a stated screen:** unverified email, expired verification link, an email already used by a player's record, a junior's email, a suspended account, a Google address the club does not hold, the wrong club, an unknown club address, an already signed-in person.
- **E. A beta deployment checklist and smoke test** that the owner can follow and tick, tied to the realm checklist in `docs/deployment.md`.
- **F. No data model change** (Decision 14) and the smallest API change that makes the above true.

### Findings (verified in code, 2026-11-13)

| # | Finding | Where | Consequence |
|---|---|---|---|
| F1 | Create Account and Continue With Google in the Log in dialog navigate to the root domain (`/register`, `/login?idp=google`); the dialog's remembered club (`login:lastClub`) and a picked club are not used | `ui/src/pages/view/LandingPage/FindYourClubLogin.tsx` | The club is lost for the most common beta route |
| F2 | `/post-login` for a signed-in person with a `Person` but no profile and no players goes to `/admin` ("Not authorized"); only `personId === null` goes to `/welcome`. `/welcome` itself calls `POST /me/register`, so every self-registered, still unlinked person hits this on their next login | `PostLoginRedirect.tsx` | Dead end on the second login of every new parent |
| F3 | `/post-login` opened with no pending OAuth callback (as a Keycloak Home URL link does) sends an unauthenticated `activate` (401), which `PostLoginRedirect` turns into `navigate('/admin')`; `/post-login` is deliberately excluded from the 401 handling | `PostLoginRedirect.tsx`, `api/axiosConfig.ts`, `auth/keycloak.ts` | The Home URL the checklist proposes would strand people unless this is fixed |
| F4 | `FindYourPlayersPage` treats every 403 as "verify your email"; a suspended person (`AccessDeniedException`, 403 without the `EMAIL_NOT_VERIFIED` code) is told to verify their email | `FindYourPlayersPage.tsx`, `MeServiceImpl.refuseSuspended` | Wrong message; the suspended status screen is only used on `/post-login` |
| F5 | The 409 for an email held by an under-18 player's record says "someone else at your club", which is wrong on the root domain and carries no machine code | `MeServiceImpl.register` | The page can only show a raw message |
| F6 | There is no server-side club resolution by host (002's `TenantResolutionFilter` was never built) and no public lookup of one club by slug; `GET /api/v1/public/clubs?query=` is a substring search with no minimum length or cap on the server | `PublicClubController`, `ClubSearchServiceImpl` | The UI cannot show "Welcome to <Club>" or detect a mistyped club address; a mistyped club address reaches Keycloak and fails with "Invalid parameter: redirect_uri" |
| F7 | `/register` runs no session check; for a person who is already signed in, Keycloak answers with its "You are already signed in" info page | `Register.tsx`, `auth/keycloak.ts` | Handled by Back To Application (built on this branch) but better avoided |
| F8 | The Keycloak info page's Back To Application link uses `pageRedirectUri`, then the pending action, then the client Home URL, then the theme `appUrl`; the last two are one fixed address for every club | `keycloak/themes/cricketlegend/login/info.ftl`, `theme.properties` | A person who verifies their email in a different browser or app comes back to the root domain, not their club (Decision 12) |
| F9 | Club-aware emails already exist: the agent invitation and the link-request outcome email link to `https://{slug}.{root}/account`, derived from the single `app.frontend.base-url` | `AgentInvitationEmailServiceImpl.accountUrl`, `LinkRequestOutcomeEmailServiceImpl` | These are the "invitation links"; nothing to build, only to document and test |
| F10 | The Keycloak manager invite (`execute-actions-email`) redirects to the root `/post-login` (`resetRedirectUri`), by design: a manager has a grant, so the club is resolved from the grant, not the address | `KeycloakProvisioningServiceImpl` | Unchanged |
| F11 | `docs/deployment.md` still says User registration is "Off in slices 1 and 2, On in slice 3", and proposes no Home URL, no root redirect URI row beyond the prose, and no wildcard certificate step | `docs/deployment.md` | Proposed edits are in the checklist; this spec does not edit that file |
| F12 | The owner's note asked for Valid redirect URIs "for every club subdomain via wildcard". That cannot work on Keycloak 24.0.3 (`002` ADR-03, `docs/deployment.md`); each club is registered automatically at create and update | `registerClubRedirectAccess` | The checklist verifies per-club registration instead (and needs `manage-clients` on the provisioning client) |

## Non-goals

- **No change to who is a manager, a main agent or an agent** (`119` Decisions 1, 4 to 6, 9, 14). Registration never creates manager access; a link never creates a `RoleAssignment`.
- **No club-scoped account.** An account stays global and club-free at sign-up (`001`, `119` Decision 2). This spec does not restrict a visitor from a club address to that club (Open question 4).
- **No stored, signed or cookie club hint.** Considered and rejected for the beta (Decision 2 and the trade-off table). A parent-domain cookie is Open question 7.
- **No server-side tenant resolution** (`002`'s `TenantResolutionFilter`). The server still never reads the host to decide anything; the only new server read is a public lookup of a club by slug.
- **No new registration form.** Keycloak's themed registration page stays the only form (Open question 5). No branded "check your email" screen outside Keycloak (Open question 6).
- **No token invitation link and no `Invitation` table** (`003`'s entity stays unbuilt). The club's address is the sign-up link; a manager "Copy Sign-Up Link" button is Later (Open question 9).
- **No change to the shared availability link** (`/poll/:id`, `/section-availability/:id`, `077`). It stays a no-login page on the club host and is not a sign-up entry.
- **No change to the platform admin path** (`005`): the dialog's "Platform admin? Log in here" and `/login` on the root domain stay as they are, and a platform admin is never sent to `/welcome`.
- **No second identity provider, no SMS login, no bot protection on registration** (reCAPTCHA is Open question 11), **no per-club Keycloak branding** (`119` Decision 22), **no Afrikaans**.
- **No change to the link-matching rules, rate limits or masked contact** (`119` Decisions 15, 16, 18 and its Security section). They are referenced, not redefined.
- **No transactional email provider change** (`119` Known limitation); the beta checklist only states what it needs.
- **No new Liquibase migration** (Decision 14).

## User Stories

Club address
- As a parent opening my club's address (for example `irene.<root>`), I can log in or create an account there, and after verifying my email I come back to that same address with the club already known.
- As a parent who clicks the invitation or outcome email a club manager caused me to receive, I land on my club's Player Hub login, not on a general page.
- As a visitor who mistypes a club address, I am told that club does not exist and offered the general page, not shown a Keycloak redirect error.

General page
- As a parent on the root domain, I can search for my club in the Log in dialog and be taken to my club's address to log in, create an account or continue with Google, with the club carried.
- As a returning visitor, the dialog remembers my club and offers Create Account and Continue With Google for that club.
- As a parent who does not know which club holds my player, I can create an account or continue with Google without a club and choose the club afterwards.
- As a platform admin, I still log in from the dialog's last button and land in `/admin`.

New, unlinked account
- As a new account on a club address, I see "Welcome to <Club>", the players that club holds under my verified email first, and an ask-the-club form with that club preselected.
- As a new account whose email no club holds (including a Google account with a different address), I get a plain "No player found" with the ask-the-club form, never a dead end and never a list of other people's players.
- As a registered but still unlinked account signing in again, I land on Find Your Players again, not on "Not authorized".
- As a new account whose verification link expired, I can ask for a fresh one without starting over.

Already signed in, wrong club, special accounts
- As a signed-in person opening another club's address, I am not shown a Keycloak dead end; I continue to the profile that belongs to me and can still link players at that club.
- As a manager, I enter through my club's address and land in `/manage` exactly as before; the address never changes what I may do.
- As a person whose email is on a junior's record, or whose account is suspended, I get a specific, kind message and a way forward.

Operator
- As the owner deploying a beta, I have a checklist for DNS, TLS, environment values, Keycloak and Google, a smoke-test script, and a rollback.

## Decisions

Settled as the recommended defaults of this draft unless an Open question says otherwise. All dates 2026-11-13 (owner request); each is binding on this spec once approved.

1. **The account is global and club-free at sign-up; the club comes only from a player link** (confirmation by verified email match, a link request a manager approves, or an invitation). This restates `119` Decisions 2 and 4; nothing in this spec gives a club hint any power.
2. **The club a person came from is the host they are on, and the host is the whole carrying mechanism.** `keycloak.login()` and `keycloak.register()` already pass `redirectUri = window.location.origin + '/post-login'`, and the origin is the club's registered redirect URI, so the club survives the Keycloak login page, the registration form, the Verify Email step (when the link is opened in the same browser), the Google broker (the first-broker-login flow keeps the auth session and its redirect URI) and Forgot Password. No cookie, no `localStorage` write, no signed parameter is added for this. The hint only ever **preselects** (the club in the ask-the-club form, the "Welcome to <Club>" line, the order of matches). It never grants access, never filters what `GET /me/player-matches` returns, and the server never receives it.
3. **Three entry forms, one rule each.** (a) Club address: the club is the host. (b) General page with a club chosen (search result or the remembered club): the browser navigates to that club's address first, so (a) applies. (c) General page with no club: the flow runs on the root domain, club-free, and the person chooses the club on Find Your Players (or is matched by email without choosing one).
4. **The Log in dialog is club-aware where it can be (F1).** Picking a club from the search results still goes straight to `https://{slug}.{root}/login` (unchanged). When a remembered club exists (`login:lastClub`, set only on the root origin when a club is picked), the "new here" row reads "New to <Club>?" and its Create Account and Continue With Google go to that club's address (`/register`, `/login?idp=google`), with a quiet "Not <Club>? Search above" cue. With no remembered club the row is unchanged and club-free (Decision 3c). Platform admin stays the last, separate button.
5. **A club address that does not exist (or is not `ACTIVE`) is detected before Keycloak is called.** `/login` and `/register` on a club host look the club up by slug (new `GET /api/v1/public/clubs/by-slug/{slug}`) and, on a 404, show `StatusScreen kind="not-found"` with a Go To The General Page action. If the lookup cannot be completed (network error), the page fails open and continues to Keycloak, because the lookup is a courtesy, not a gate.
6. **`/register` checks for an existing session first (F7).** `/register` joins `AUTH_AWARE_PATH_PREFIXES`; after `keycloakInitPromise`, an authenticated person goes to `/post-login`, otherwise `keycloak.register()` runs as today. (`/login` is unchanged: `keycloak.login()` with an SSO session returns silently.) The Back To Application link stays as the safety net for the cases this cannot cover.
7. **`/post-login` is made safe to open at any time (F3).** After `keycloakInitPromise`, if `keycloak.authenticated` is false and there is no pending callback, `PostLoginRedirect` calls `keycloak.login({ redirectUri: origin + '/post-login' })` (silent when an SSO session exists, the sign-in page otherwise) instead of calling `activate` unauthenticated. This makes the client Home URL `https://<root>/post-login` a valid "Back to application" target.
8. **A verified-but-unlinked account's home is `/welcome` (F2).** In `PostLoginRedirect`, when `/me/activate` returns no profiles, the caller is not a platform admin, has no club-admin grant and holds no players, the destination is `/welcome` whether or not a `Person` exists. The `/admin` fallback remains only for the case it was written for (an older response without `profiles`).
9. **Find Your Players learns the club from the host.** On a club host it calls the new by-slug lookup once and shows a "Welcome to <Club>" line above the heading. The visited club's matches are listed first (a client-side order; the server response is unchanged), and the ask-the-club form's club select starts on the visited club. On the root domain it falls back to the remembered club (`login:lastClub`) for the preselection only, and shows no welcome line. The page still lists every match for the verified email at every club (`119` Part 3 step 1); the hint never narrows it.
10. **Copy rules by surface.** The landing page, the Log in dialog, Keycloak pages and the sign-up screens that speak to a person who has no player yet (`/welcome` and its sub-views) may use second person, as they do today. Everything inside the Player Hub (`/account/players/...` and the Hub pages) never says "you" or "your": it uses the player's first name (the 2026-11-12 Hub copy rule). New buttons are Title Case, compact, from the shared `Button`; the dark console keeps its outline look (`design-system.md`, dark-surface exceptions).
11. **The beta requires registration and verification to be on in the realm.** User registration On, Email as username On, Verify email On with the Verify Email required action, Duplicate emails Off (`119` Part 1 checklist), password policy, brute-force detection and a working SMTP. These become "required for beta" rows (section "Beta deployment checklist").
12. **Known limitation, accepted for the beta:** the Keycloak Home URL and `appUrl` are one fixed address for every club, so a person who opens the verification link in a different browser or app (the usual phone case) sees Keycloak's info page and its Back To Application link goes to the root domain, not the club. They sign in there; the verified email still matches their players with no club choice (Decision 3c), and the form asks for the club if a request is needed. The mitigation is the instruction text on the Verify Email page ("open the link on the same device") and Open question 7 (a parent-domain cookie).
13. **Wildcard correction (F12):** redirect URIs and web origins are registered per club, automatically, by `registerClubRedirectAccess` on club create and update; the root domain is registered by hand once. The checklist verifies each beta club and re-saves any that predate the `manage-clients` grant.
14. **No data model change.** The club hint is carried by the address and read from the address; nothing is stored. No Liquibase migration is needed (the next free number would be `064`; it is not used).
15. **API changes are three small ones:** a public by-slug lookup, a named conflict exception with a machine code for `POST /me/register`, and a minimum length plus a cap on the existing public search (Open question 8). Nothing else on `/me/**` changes.
16. **Failure screens use existing components:** `StatusScreen` for whole-page states, `Alert` inside the dark console for in-page ones, Keycloak's themed pages for anything Keycloak decides.

## Entry points: what is carried

| # | Entry | Exact path | Club carried by | Lands (signed out to signed in) |
|---|---|---|---|---|
| 1 | Club address, log in | `https://{slug}.{root}/` redirects to `/login`; `Login` calls `keycloak.login({ redirectUri: origin/post-login })` | The host | Keycloak sign-in, back to `{slug}.{root}/post-login`, then the person's profile (a Hub person goes to `/account`; a manager to `/manage`; an unlinked account to `/welcome` with the club known) |
| 2 | Club address, create account | `{slug}.{root}/register` (`keycloak.register`) | The host | Keycloak registration form, Verify Email page, then (same browser) the verification link continues the flow to `{slug}.{root}/post-login`, then `/welcome` |
| 3 | Club address, Google | `{slug}.{root}/login?idp=google` (`idpHint=google`, only the known alias is passed) | The host | Google, Keycloak broker (Trust Email, `cricketlegend first broker login`), back to `{slug}.{root}/post-login`. A first-time Google address becomes a new Keycloak user with a verified email |
| 4 | Agent invitation email (`119` slice 4) | `https://{slug}.{root}/account` (button "Open Player Hub") | The host (built from `app.frontend.base-url`) | Signed out: the 401 on the auth-aware path sends the browser to `/`, which is `/login` on a club host, then `/post-login`, then the Hub shows the invitation (the person must log in or register with the invited, verified email) |
| 5 | Link-request outcome email | `https://{slug}.{root}/account` | The host | As above; the outcome is also shown in the app (`119` Decision 13) |
| 6 | Keycloak manager invite | Keycloak action link, redirect `https://<root>/post-login` | Not needed: the manager's grant names the club | Set password, verify email, `/post-login`, `/manage` (or the chooser). Unchanged |
| 7 | Poll or availability share link | `{slug}.{root}/poll/:id`, `/section-availability/:id` | The host | A public no-login page. Not a sign-up route; a person who wants an account goes to the same host's `/` |
| 8 | Log in dialog, club picked | `{slug}.{root}/login` | The host (the browser navigates there first) | As entry 1. The club is remembered in root `localStorage` (`login:lastClub`) |
| 9 | Log in dialog, remembered club | "New to <Club>?" then `{slug}.{root}/register` or `/login?idp=google` | The host | As entries 2 and 3 |
| 10 | Log in dialog, no club | `<root>/register` or `<root>/login?idp=google` | None (Decision 3c) | Keycloak, back to `<root>/post-login`, then `<root>/welcome` (club-free). Matches by email still work; the club select is empty unless exactly one club exists or a remembered club exists |
| 11 | Platform admin | `<root>/login` | None | `/post-login`, then `/admin`. Unchanged |
| 12 | Keycloak "Back To Application" | client Home URL `https://<root>/post-login` (and theme `appUrl`) | None (Decision 12) | With Decision 7 this signs the person in silently (SSO) or shows the sign-in page, then continues |

### Keeping the club across the email and Google round trips: options

| Option | How | Survives verify email (same browser) | Survives verify email (other browser) | Survives Google | Risk and cost | Verdict |
|---|---|---|---|---|---|---|
| A. The host is the redirect URI (chosen) | Already how `login`/`register` are called | Yes (the auth session holds the redirect URI) | Partly: Keycloak's action token carries the client and redirect data, so the info page may offer a link back to the club (to verify, F8); otherwise the fixed Home URL | Yes | None added; relies on every club's redirect URI being registered | **Chosen** |
| B. Signed `club` query parameter on the redirect | HMAC the slug into `?club=` on `/post-login` | Yes | No (the email link is Keycloak's) | Yes | A secret to manage and rotate, to carry something that grants nothing | Rejected |
| C. Cookie on the parent domain (`Domain=.<root>`) | The SPA sets `cl_club=<slug>` before redirecting to Keycloak | Yes | Yes, if the other browser is the same device profile; no otherwise | Yes | Readable by every club host; not testable on `*.localhost`; consent wording; stale values | Deferred (Open question 7) |
| D. `localStorage` | Write the slug before redirecting | Per origin only (club host to the same club host) | No | Per origin | Redundant with A on a club host; on the root it is `login:lastClub`, used for preselection only (Decision 9) | Root fallback only |
| E. Unsigned `?club=` hint on root URLs | `<root>/register?club=irene` | n/a | n/a | n/a | A second way to say what the address already says | Not built; the club address is the link |

## Data Model Changes

None. The club hint is carried by the address and read from the address (Decisions 2 and 14). `Person`, `PlayerProfile`, `person_link`, `link_request`, `link_attempt` and `Club` are used as `001` and `119` define them. No column, table, index or Liquibase migration is added or changed, and no applied migration is touched. (If a later decision stores a per-club sign-up setting, it is a new migration numbered after `063`, in its own spec.)

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/public/clubs/by-slug/{slug}` (new) | public (`/api/v1/public/**` is `permitAll`) | Returns `ClubSummaryDto { id, name, slug }` for an `ACTIVE` club whose slug equals `{slug}` (case-insensitive), otherwise 404 with the same body for "unknown" and "not active". Exposes exactly what `GET /api/v1/public/clubs?query=` already returns for that club (no branding, contacts, counts or status). `{slug}` is validated against the slug pattern; anything else is 404 without a query. Limited per client address by the 077 pattern (`PublicAttemptTracker`, a named constant `MAX_LOOKUPS_PER_ADDRESS`, 60 per window); over the limit is 429 `PublicRateLimitedException` with `retryAfterSeconds`. Controller `PublicClubController`, service `ClubSearchService.findActiveBySlug` (+ impl), repository `findBySlugIgnoreCaseAndStatus`, mapper `ClubMapper.toSummaryDto` (reused). |
| `GET /api/v1/public/clubs?query=` (existing, hardened) | public | A query shorter than 2 characters after trimming returns an empty list; the list is capped at 20 clubs by name. Matches the UI's existing 2-letter minimum on the server so the landing search cannot be used to list every club (Open question 8). |
| `POST /api/v1/me/register` (existing) | verified email | Unchanged shape and idempotent. The refusal for an email held by another `Person` (an under-18 player's record) becomes `EmailOnPlayerRecordException extends ConflictException`, 409, with problem property `code` = `EMAIL_ON_PLAYER_RECORD` and the message "This email address is already used on a player's record. Ask the club to correct it, or sign in with a different email address." (set by its own `GlobalExceptionHandler` method, per `backend.md`; no new base type or status). A suspended person remains 403 (`AccessDeniedException`) with no `EMAIL_NOT_VERIFIED` code; an unverified token remains 403 `EMAIL_NOT_VERIFIED`. |
| `GET /api/v1/me/player-matches`, `POST /api/v1/me/links`, `POST/GET/DELETE /api/v1/me/link-requests`, `GET /api/v1/me/clubs`, `GET /api/v1/me/clubs/{clubId}/sections`, `POST /api/v1/me/activate`, `GET /api/v1/me/profiles` (existing) | as in `119` | **Unchanged.** No `club` parameter is added to any of them: the hint is never sent to the server, so it cannot be abused to widen a lookup. The visited-club ordering and the club preselection are client-side. |

Security notes:
- **No enumeration beyond the landing search.** By-slug returns only what a search by that slug returns, for `ACTIVE` clubs only, with one indistinguishable 404, a per-address limit and no other lookup (no id lookup, no list). Hardening the search (min 2, cap 20) removes the ability to list every club with a one-letter query.
- **The hint grants nothing.** By-slug is read for display and preselection only. A visitor can type any slug on their own browser; nothing server-side reads it. Access still comes only from a verified-email match, an approved request or an invitation (`119`).
- **Abuse.** Registration abuse (account spam, verification-email flooding) is Keycloak's domain: brute-force detection, the daily SMTP allowance (`docs/deployment.md`), and Open question 11. The link-request limits of `119` are unchanged.
- **Logging.** The by-slug lookup logs at most the slug and the result class; a registration conflict logs ids only. No email address is logged by the new code.

## UI Requirements

Composes from existing pieces; nothing new is added to `components/` except where noted. Mobile first at 390 px (the Hub and sign-up screens must not scroll sideways at 375 px).

Screens and states

1. **Log in dialog (`FindYourClubLogin`).** Search, results and "Continue to <Club>" are unchanged. The "new here" row has two states. *Remembered club:* "New to <Club>?" with Create Account and Continue With Google (compact outline buttons, Title Case, 44 px touch targets) that navigate to the club's address, plus a text link "Not <Club>? Search Above" that clears the memory for the row. *No remembered club:* the existing text and buttons, going to the root domain. Platform admin remains the last button. No lone control in its own row (`design-system.md`, layout density): the cue is on the row of the buttons.
2. **`Login` and `Register` on a club host.** Full-page `FullPageLoader` while the by-slug lookup and the redirect run. Unknown club (404): `StatusScreen kind="not-found"`, heading from the existing set, one sentence ("That club address does not exist"), one compact gold action "Go To The General Page" (the root origin). Network failure: fail open to Keycloak. On the root domain no lookup is made.
3. **`Register` while signed in:** a brief loader, then `/post-login` (Decision 6). No Keycloak page is shown.
4. **`PostLoginRedirect`:** unauthenticated and no callback means `keycloak.login()` (Decision 7); registered but unlinked means `/welcome` (Decision 8). A 403 that is not `EMAIL_NOT_VERIFIED` is the existing `StatusScreen kind="suspended"`.
5. **Find Your Players (`/welcome`).** Inside the existing `HubFrame`. On a club host a "Welcome to <Club>" line sits above the "Find your players" heading (display face, cream, one line, truncates on a phone). The matches list is ordered visited club first, each with its club name already in the detail line. The ask-the-club form's club select starts on the visited club (or the remembered club on the root). Failure states: unverified email keeps today's warning but is chosen only by the `EMAIL_NOT_VERIFIED` code (F4); a suspended account shows `StatusScreen kind="suspended"`; a 409 `EMAIL_ON_PLAYER_RECORD` shows an `Alert severity="warning"` with the API message and two actions, "Use A Different Account" (signs out and returns to the same host's `/login`) and "Ask The Club To Correct It" (opens the ask-the-club form with the visited club). "No player found" keeps its copy and shows the signed-in address, plus a quiet "Use A Different Account" action for the Google-with-another-address case. Nothing on this page ever shows a player the verified email does not match.
6. **Keycloak pages (theme `cricketlegend`).** Second person is allowed. The Verify Email page gains one line: "Open the link on this device to carry on where you left off." (`messages_en.properties`). The info page's Back To Application rules stay as built on this branch. An expired action link uses the stock error page's restart link, themed; wording is verified on the beta Keycloak (checklist).
7. **Hub (`/account`)** is unchanged except that a person with no players and no invitations is never redirected to `/admin` (Decision 8); `MyPlayersPage`'s Link More Players tile continues to lead to `/welcome`.

Copy
- Surfaces with second person: landing, dialog, Keycloak, `/welcome` and its sub-views. Hub pages: first name only, no "you" or "your" (Decision 10). New strings are listed in the component tests so they cannot drift.
- Examples: "Welcome to Irene CC"; "No player found"; "That club address does not exist"; "New to Irene CC?"; "Not Irene CC? Search Above".

Files expected to change (names only; the plan decides the rest): `FindYourClubLogin.tsx`, `Login.tsx`, `Register.tsx`, `PostLoginRedirect.tsx`, `FindYourPlayersPage.tsx`, `LinkRequestForm.tsx` (initial club), `auth/keycloak.ts` (`/register` in the prefixes, comment updated), `api/publicClubApi.ts` or `leadApi.ts` (a `getClubBySlug`), a small `utils/clubFromHost.ts` (the one place that reads the slug from `window.location.hostname` against `VITE_ROOT_DOMAIN`, shared with `App.tsx`'s `isRootDomain` and `utils/activeProfile.ts` rather than copied), the theme `messages_en.properties`.

## Test Plan

Per `docs/standards/testing.md`. Unit and integration carry the weight; Playwright covers one golden path per entry route; the owner's smoke test is the beta gate.

**Unit (backend):** `ClubSearchServiceImplTest` (by-slug returns the summary for an `ACTIVE` club, is case-insensitive, returns empty for `ONBOARDING`, `SUSPENDED`, unknown, malformed; search returns empty under 2 characters and caps at 20); the per-address limit (over the limit is `PublicRateLimitedException`); `MeServiceImplTest` (the under-18 email conflict throws `EmailOnPlayerRecordException` with the code and the new message; a suspended person is `AccessDeniedException` and is not mistaken for `EMAIL_NOT_VERIFIED`).

**Integration (Testcontainers, `AbstractIntegrationTest`):** `PublicClubControllerIntegrationTest` (by-slug is reachable unauthenticated, 404 body identical for unknown and inactive, the response has exactly `id`, `name`, `slug`, 429 after the limit); the repository query `findBySlugIgnoreCaseAndStatus`; `POST /me/register` returns 409 with `code = EMAIL_ON_PLAYER_RECORD` for an under-18 holder of the email. No test wraps itself in a class-level `@Transactional` that would hide a lazy-load (`backend.md`).

**Contract:** the new endpoint, the search behaviour note and the new 409 are in the checked-in OpenAPI schema; the diff is additive.

**Component (Vitest + Testing Library):**
- `FindYourClubLogin`: with `login:lastClub` set, the row reads "New to <Club>?" and the two buttons navigate to `{slug}.{root}/register` and `/login?idp=google`; without it they go to the root `/register` and `/login?idp=google`; "Not <Club>?" clears the memory; picking a result still goes to the club `/login`; the platform admin button still goes to `/login`.
- `Login`/`Register`: on a club host they look up the slug; 404 shows the not-found `StatusScreen` and never calls `keycloak`; a network error continues to `keycloak.login`/`register`; on the root domain no lookup is made; `?idp=google` passes only the known alias; `Register` with an authenticated session goes to `/post-login` and does not call `keycloak.register`.
- `PostLoginRedirect`: unauthenticated with no callback calls `keycloak.login` and does not call `activate`; a registered person with no profiles, no players and no grants goes to `/welcome` (never `/admin`); a platform admin goes to `/admin`; one profile goes home; several go to the chooser; a plain 403 shows the suspended screen.
- `FindYourPlayersPage`: the welcome line appears only with a resolved club; matches are ordered visited club first and none is hidden; the form's club starts on the visited club, then on the remembered club on the root; a suspended 403 does not show the verify-email warning (F4); `EMAIL_NOT_VERIFIED` does; the 409 shows the message and the two actions; "No player found" shows the address and "Use A Different Account".
- `utils/clubFromHost`: root, club host, nested host, port, `localhost`, a host that is not under the root domain.
- Copy guard: the Hub files under `pages/view/myPlayers/` still contain no "you"/"your" in new strings (existing guard pattern).

**Theme (manual, per `keycloak/README.md`):** Verify Email page shows the new line at 320 and 1280 px; info page Back To Application for each rule order.

**End to end (Playwright, golden paths only, mobile and desktop viewport; against the local Keycloak with Mailpit as the mail sink, not in CI, the same precedent as `016` and `119`):** (1) club address `irene.localhost:5173`: `/` to Keycloak, register with a new email, read the verification email from Mailpit, open the link in the same browser, land on `irene.localhost:5173/welcome` showing "Welcome to Irene CC"; (2) club address with an email held by a player record: pre-ticked list, Confirm, Player Hub; (3) general page: Log in dialog, search, pick the club, arrive on the club host `/login`; (4) general page with a remembered club: Create Account goes to the club host `/register`; (5) general page, no club: Create Account on the root, then `/welcome` with no welcome line and the club select empty; (6) signed in at club A, open club B's `/register`: no Keycloak info page, lands in the person's home; (7) unknown club address shows the not-found screen. Google cannot be automated; it is covered by the manual smoke test and, locally, by a stubbed `idpHint` assertion on the `keycloak.login` call.

**Manual beta smoke test:** in "Beta deployment checklist", step 12.

## Acceptance Criteria

- On a club address, **log in, create an account and Continue With Google** each return to the same club address (`{slug}.{root}/post-login`) and `/welcome` shows "Welcome to <Club>" for an unlinked account; no cookie, `localStorage` entry or query parameter was needed for that.
- A new account's **verification link opened in the same browser** continues to the club address; opened in another browser the person reaches a Keycloak page with a Back To Application link (to the club if Keycloak supplies the redirect, otherwise to `https://<root>/post-login`), and either way can sign in and be matched by email.
- In the Log in dialog, **a remembered club turns Create Account and Continue With Google into club-address links**; with no remembered club they are club-free and `/welcome` on the root works with no club preselected; Platform admin still reaches `/admin`.
- **A registered, unlinked account signing in a second time lands on `/welcome`**, never on "Not authorized" or `/admin`.
- **Opening `https://<root>/post-login` with no session** starts a sign-in (silent with an SSO session); it never lands on `/admin`.
- A visited club's matches are listed first, **no match is hidden or added by the hint**, and the server response of `GET /me/player-matches` is byte-for-byte what it was.
- A mistyped club address shows the not-found screen with a way to the general page; an inactive club's address does the same; a Keycloak redirect error is not the user's first symptom.
- A suspended person never sees "verify your email"; an unverified token does; an email held by an under-18 player's record gets `EMAIL_ON_PLAYER_RECORD` and a message that names the way forward; a Google address the club does not hold gets "No player found" and the ask-the-club form; none of these is a dead end.
- A signed-in person opening another club's `/register` or `/login` reaches their own home with no Keycloak "already signed in" page; the Back To Application link still works where that page does appear.
- A manager entering through their club's address, or another club's, lands in `/manage` or the chooser exactly as `119` defines; the address changes nothing about access.
- By-slug returns only `id`, `name` and `slug`, only for `ACTIVE` clubs, 404 otherwise with an identical body, 429 past the limit; the public search returns nothing for a 1-character query and at most 20 clubs.
- No Liquibase migration is added; no applied migration is changed; the OpenAPI diff is additive.
- The beta checklist below is completed and ticked on the beta server, and the smoke test passes with the owner present.

## Rollout Notes

**Sequencing (each its own PR, smallest first; none starts before the one before is looked at):**
1. **Backend and theme:** the by-slug endpoint and search hardening, `EmailOnPlayerRecordException`, the Verify Email line. Safe to deploy alone.
2. **Routing fixes (the dead ends first):** `PostLoginRedirect` (Decisions 7 and 8), `FindYourPlayersPage` error handling (F4, F5). These alone remove the worst beta risk.
3. **Club awareness:** `clubFromHost`, the dialog row, `Login`/`Register` lookup and the `/register` session check, the welcome line, the preselection and ordering.
4. **Beta deployment** against the checklist, then the owner's smoke test.

**Feature flags:** none. Every change is additive or fixes a dead end; the dialog change is visible only to someone with a remembered club.

**Docs to update in the build PRs (not by this spec):** `docs/deployment.md` (the "required for beta" marks and proposed rows below, the stale User registration row, a DNS/TLS/environment section from "Next up"), `docs/architecture.md` (the club-from-host rule in the auth diagram), `docs/roadmap.md` (Open questions 7 and 9, `002`'s unbuilt `TenantResolutionFilter`, `003`'s unbuilt `Invitation`), `docs/standards/frontend.md` (the `/register` auth-aware note and the `clubFromHost` helper), `keycloak/README.md` (Home URL).

**What stays deliberately simple:** the server resolves no tenant from the host; the club hint is preselection only. If a later feature needs the server to know the visited club (per-club login branding, `119` Decision 22), it will use `clubFromHost` and the by-slug lookup, not a cookie.

## Beta Deployment Checklist

A first-class part of this spec. Tick on the beta server; nothing is assumed done because it works locally. Words in `<angle brackets>` are placeholders for the owner's real domain (for example root `beta.cricketlegend.co.za`, auth `auth.beta.cricketlegend.co.za`, clubs `{slug}.beta.cricketlegend.co.za`). **The beta needs a real public domain**: Google rejects non-public top-level domains for the broker redirect (`docs/deployment.md`, Google sign-in step 1).

**1. DNS**
- [ ] `A`/`AAAA` for `<root>` and a wildcard `*.<root>` to the front proxy (this covers `auth.<root>` and every `{slug}.<root>`). If Keycloak is on a different machine, add an explicit `auth.<root>` record.
- [ ] Reserved slugs stay reserved (`auth`, `www`, `api`, `app`, `admin`, ...; `002` ADR-04) so no club can take the auth host.

**2. TLS**
- [ ] One wildcard certificate for `<root>` and `*.<root>` (a wildcard needs the DNS-01 challenge). It covers one label: `irene.<root>` and `auth.<root>` are covered; `a.b.<root>` is not.
- [ ] HTTPS only; HTTP redirects to HTTPS (the SPA, Keycloak and the API all use `https`; `FindYourClubLogin` and `KeycloakProvisioningServiceImpl` take the scheme from the current page and from `FRONTEND_BASE_URL`).

**3. Front proxy and hosting**
- [ ] The SPA build is served for `<root>` and every `*.<root>` host with an `index.html` fallback for every path (the router is browser history), including `/login`, `/register`, `/post-login`, `/welcome`, `/account/...`.
- [ ] `/api` and `/media` are reverse-proxied to the backend on every host (same origin). **There is no CORS configuration in the backend and none is needed with a same-origin proxy**; add one only if the API is ever put on its own host.
- [ ] The proxy forwards the real client address (`X-Forwarded-For`) and the backend trusts it (`server.forward-headers-strategy`, env `SERVER_FORWARD_HEADERS_STRATEGY=framework`), otherwise the per-address limits (077, by-slug) see one address for everyone.

**4. Frontend build values (Vite reads these at build time; one build serves every host)**
- [ ] `VITE_ROOT_DOMAIN=<root>` with no scheme and no port in production. It decides `isRootDomain`, the club-address links and `clubFromHost`.
- [ ] `VITE_KEYCLOAK_URL=https://auth.<root>`, `VITE_KEYCLOAK_REALM=<realm>`, `VITE_KEYCLOAK_CLIENT_ID=<client>`. The realm and client names are still an open decision in `docs/deployment.md` ("Realm & client naming"); settle them before the Google client is created, because the realm name is part of the broker redirect URI.

**5. Backend environment**
- [ ] `KEYCLOAK_ISSUER_URI=https://auth.<root>/realms/<realm>` (must equal the `iss` of issued tokens, and be reachable from the backend at startup).
- [ ] `FRONTEND_BASE_URL=https://<root>` (no trailing slash). It builds every club address in emails and the per-club redirect URI registration (`https://{slug}.<root>`), so it must be the root, not a club.
- [ ] `KEYCLOAK_ADMIN_SERVER_URL`, `KEYCLOAK_ADMIN_REALM`, `KEYCLOAK_ADMIN_CLIENT_ID=platform-provisioning`, `KEYCLOAK_ADMIN_CLIENT_SECRET`, `KEYCLOAK_PUBLIC_CLIENT_ID`; the `platform-provisioning` service account has **both** `manage-users` and `manage-clients`.
- [ ] `SMTP_*` and `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, `MAIL_SUPPORT_ADDRESS`; secrets `IMPORT_TOKEN_SECRET` (the app refuses to start without it outside `dev`) and `PUBLIC_AVAILABILITY_TOKEN_SECRET`; `MEDIA_STORAGE_PATH` on persistent storage; the database URL and credentials.
- [ ] Club resolution: the backend resolves **no** club from the host (there is no tenant filter); nothing to configure. A club is reachable when its row is `ACTIVE`, its slug is not reserved and its redirect URI is registered (step 7).

**6. Keycloak server (24.0.3)**
- [ ] Persistent install, not a bare `docker run` (`docs/deployment.md`, known local-only caveat). Hostname `auth.<root>`, HTTPS, the proxy mode for 24.0.3 (`--proxy=edge` behind a TLS-terminating proxy) so issued URLs are `https://auth.<root>/...`.
- [ ] The realm is brought up from an export of the local realm, then reviewed row by row (below). Exports do not carry client secrets or users: re-enter the Google client secret and the provisioning client secret by hand; create the first platform admin user by hand.
- [ ] Theme installed from `keycloak/package.sh` or the CI artifact `cricketlegend-login-theme` into `/opt/keycloak/themes/`, then restart; Realm settings, Themes, Login theme `cricketlegend`.
- [ ] Theme `appUrl` (optional) set to `https://<root>/post-login`; the same address as the client Home URL below. After Decision 7 this link is safe for a person with or without a session.

**7. Keycloak client (the public SPA client)**
- [ ] Standard flow on, PKCE `S256`, Direct access grants **off**, Public client.
- [ ] **Root URIs by hand, once:** Valid redirect URI `https://<root>/*`, Web origin `https://<root>`, Home URL `https://<root>/post-login`, and Valid post logout redirect URIs `+` (if sign-out shows "Invalid redirect uri").
- [ ] **No wildcard.** Per-club entries `https://{slug}.<root>/*` and `https://{slug}.<root>` are added automatically when a club is created or saved. After the first club is created on the beta, open the client and confirm both entries exist. Any club created before the `manage-clients` grant, restored from a database copy or loaded by SQL needs one no-op Save in the club edit screen to register.
- [ ] Verify with a club whose slug is mistyped: `https://nope.<root>/login` shows the not-found screen (this spec), not a Keycloak error.

**8. Realm login settings (rows of `docs/deployment.md`'s "Login theme and realm checklist": required for beta, and proposed additions)**

| Row | Beta |
|---|---|
| Required action Verify Email | **Required for beta** |
| Login: Verify email | **Required for beta** |
| IdP Google: Trust Email, Store tokens off, First login flow `cricketlegend first broker login`, Google Cloud OAuth client | **Required for beta** (step 9) |
| Themes: Login theme `cricketlegend` | **Required for beta** |
| Login: Forgot password, Login with email, Email as username, Duplicate emails Off | **Required for beta** |
| Login: User registration | **Required for beta, set On** (the row text "Off in slices 1 and 2, On in slice 3" is stale) |
| Password policy `length(10) and digits(1)` | **Required for beta** (the registration page promises it) |
| Tokens: Default user-initiated action lifespan | **Required for beta**, raise from 5 minutes to at least 1 hour (suggest 1 day): the verify and reset links are read on a phone later |
| Security defenses: Brute force detection | **Required for beta** |
| Email (SMTP) | **Required for beta**, with the Google account allowance (about 500 a day, shared with the backend) in mind: every registration sends one email |
| Remember me, Edit username Off, SSO session idle/max, Display name, Terms and Conditions Off | Recommended |
| **Proposed additions:** client Home URL `https://<root>/post-login` and root redirect URI and origin; per-club registration check (step 7); Valid post logout redirect URIs; hostname and proxy mode; "Direct access grants off"; a line that the realm name is part of the Google redirect URI; a row for the action-token expiry page wording | Add to the table |

**9. Google**
- [ ] A Google Cloud OAuth client (Web application) for the beta host; **Authorized redirect URI** exactly `https://auth.<root>/realms/<realm>/broker/google/endpoint`; scopes `openid email profile`; Testing mode with test users is acceptable for a small beta (add every tester's Google address), publishing needs the consent screen, privacy-policy and terms URLs (`docs/deployment.md`).
- [ ] Keycloak, Identity providers, Google: client id and secret, display name `Continue with Google`, **Trust Email On**, Store tokens Off, Hosted domain empty, default mappers, no role or group mapper, **First login flow override `cricketlegend first broker login`** (Review Profile disabled, Automatically Set Existing User under Handle Existing Account).

**10. Data and first club**
- [ ] Database created, Liquibase applied through migration `063` on first start; no migration is added by this spec.
- [ ] A platform admin signs in at `https://<root>` (dialog, last button) and creates the beta club; the club is activated (`ACTIVE`) and its first admin invited. Create at least one section, one team and a player holding a test parent's email, and one player under 18 whose record carries a parent's email (for the conflict case).

**11. Rollback**
- [ ] Application: redeploy the previous backend and frontend builds; nothing in this spec adds a migration, so the database stays as it is. Theme: replace with the previous zip and restart Keycloak. Realm: keep the pre-change export and re-import or revert the changed settings. DNS and certificate: leave in place (harmless). Registration can be switched off at once in the realm (User registration Off) without a deploy; existing accounts and links are unaffected.

**12. Smoke test script (the owner, on phone and desktop; write the result next to each line)**
1. Create the club as platform admin; confirm both per-club redirect entries appear in the Keycloak client.
2. From the root domain: open the Log in dialog, search the club, pick it; arrive on `https://{slug}.<root>/login`; sign in as the club admin; reach `/manage`; sign out and sign in again.
3. **Parent by email, from the club address:** open `https://{slug}.<root>/register`, create an account with the test parent email, receive the verification email, open the link on the same device, arrive on `https://{slug}.<root>/welcome` with "Welcome to <Club>", see the pre-ticked player, Confirm, reach Player Hub.
4. **Parent by email, from the general page:** with a remembered club, Create Account in the dialog goes to the club address; with the memory cleared, Create Account goes to the root and `/welcome` works with the club chosen by hand.
5. **Parent by Google, from the club address and from the general page:** `…/login?idp=google` on the club host and the dialog's Continue With Google; first sign-in creates the account; the second sign-in lands on Find Your Players or Player Hub, never "Not authorized".
6. **Unlinked account:** a parent whose email the club does not hold sees "No player found"; sends a request with the club preselected; the club admin approves it under Access, Player accounts; the parent sees it Accepted and receives the email.
7. **Invitation:** the main agent invites a second parent by email; the email's "Open Player Hub" link opens the club address; the invitee registers with that email and accepts.
8. **Conflicts:** register with the email held by the under-18 player's record (message with the two actions); disable a test account in Keycloak and sign in (suspended screen); let a verification link expire (action expired page with a restart link); open the verification link in another browser (info page with Back To Application).
9. **Already signed in:** while signed in at club A, open club B's `/register` and `/login`; no dead end.
10. **Wrong or unknown club:** `https://nope.<root>/login` shows the not-found screen.
11. **Forgot password:** from the club address, request a reset, set a new password from the email, sign in.
12. **Sign out and sign in** on both hosts; confirm sign-out returns to a working page.

## Open questions

Each has a default the spec assumes unless the owner decides otherwise.

1. **Should registration be allowed on the root domain at all, or only from a club address?** Default: allowed, club-free (Decision 3c). Google users and parents who do not know their club exist, and the verified email match needs no club.
2. **Is the club hint trusted for anything beyond preselection?** Default: no, never. It does not filter matches, create links or change access.
3. **Invitation links for adult players versus parents?** Default: the same entry points and the same flow; an adult player sees "Is this you?" on the same Find Your Players page (`119` Decision 28). No separate adult link.
4. **Can a visitor from a club address create an account and see only that club?** Default: no. The account is global; matches follow the verified email across clubs; the visited club is only listed first (Decision 9).
5. **Keep Keycloak's registration page as the only registration form?** Default: yes, themed, no separate app form (it would need a new registration API and duplicate password rules).
6. **A branded "check your email" step outside Keycloak?** Default: no. The themed Verify Email page is the step, with the one added line; revisit after the beta shows where people stall.
7. **A parent-domain cookie (`Domain=.<root>`) as a fallback for the other-browser verification case?** Default: not built. Revisit if beta testers report landing on the root after verifying; it is not testable on `*.localhost`.
8. **Harden `GET /api/v1/public/clubs` with a 2-character minimum and a cap of 20?** Default: yes, as written. It changes an existing public endpoint's behaviour (not its shape).
9. **A manager "Copy Sign-Up Link" button?** Default: Later. For the beta the owner shares the club address; the button belongs to a Club Profile or Access change in its own spec.
10. **A person who has no link at the visited club but a manager or Hub profile elsewhere: show a notice on arrival?** Default: no notice; they continue to their own home (`119` Decision 29, no silent club switching) and can reach Find Your Players from Link More Players.
11. **Bot or spam protection on registration (reCAPTCHA in the Keycloak registration flow, an invite-only beta)?** Default: none for the beta; the beta address is unadvertised, Verify Email and brute-force detection are on, and registration can be switched off in the realm instantly. Revisit before a public launch.
