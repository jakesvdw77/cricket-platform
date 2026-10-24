# Keycloak login theme (`cricketlegend`)

The Cricket Legend look for every Keycloak login page: sign in, forgot password, verify email,
update password and profile, terms, error, expired page, logout, registration and the
identity-provider pages. Spec: `docs/specs/119-login-account-journey.md` (Part 1). Plan:
`docs/plans/119-login-account-journey.md` (slice 1).

It is a **login theme only**. No change to the account console, the admin console or Keycloak's
emails. Plain CSS plus two small FreeMarker overrides and a messages file: Keycloak renders these
pages on the server, so MUI cannot be used here (a recorded exception to the "MUI only" rule,
`CLAUDE.md`). No JavaScript, no build step, no third-party requests (fonts and images are served
from the theme itself).

## What is in it

```
keycloak/
  themes/cricketlegend/login/
    theme.properties                 parent=keycloak (stock 24.0.3 theme), styles=css/login.css css/cricketlegend.css
    messages/messages_en.properties  heading, labels, friendly error wording
    login-reset-password.ftl         override: instruction above the field, "Send reset link", back link under the button
    login-verify-email.ftl           override: mail icon, address chip, Resend button, "Use a different account"
    resources/css/cricketlegend.css  tokens + layout + every page
    resources/fonts/                 Barlow Condensed 600/700, Barlow 400/500/600 (Latin and Latin Extended woff2) + OFL licences
    resources/img/                   mark.svg, google.svg, favicon.ico
  META-INF/keycloak-themes.json      only used for the provider-JAR form
  package.sh                         builds keycloak/dist/ (zip of the folder, and a theme JAR)
```

Why only two `.ftl` files: everything else is CSS and messages on top of the stock templates, so a
Keycloak upgrade that changes an untouched template keeps working. Add an override only where CSS
and messages genuinely cannot do it, and say why in a comment at the top of the file. Both
overrides here start from the stock 24.0.3 templates; after a Keycloak upgrade, diff them against
the new stock `login-reset-password.ftl` and `login-verify-email.ftl`.

The token block at the top of `cricketlegend.css` is a **deliberate copy** of the brand values
(Keycloak cannot import `ui/src/theme.ts`). Update it by hand when brand tokens change
(`docs/standards/design-system.md`).

## Run it locally

You need Docker. Three ways, safest first.

### A. Mount the folder into the container you already have (no data risk)

The existing hand-started container, `cricketlegend-keycloak-dev`, has **no volume**: its realm
lives inside the container, so removing or recreating it loses the realm. Copy the theme in and
restart (a restart keeps the container filesystem):

```
docker cp keycloak/themes/cricketlegend cricketlegend-keycloak-dev:/opt/keycloak/themes/
docker restart cricketlegend-keycloak-dev
```

Repeat the `docker cp` after each theme change (`start-dev` serves themes uncached, so a browser
refresh is enough, no restart needed after the first one).

### B. The compose file (a new container with a named volume)

```
docker compose -f docker-compose.keycloak.yml up -d
```

Container `cricketlegend-keycloak`, image `quay.io/keycloak/keycloak:24.0.3`, port `8180`,
admin `admin` / `admin` (override with `KEYCLOAK_ADMIN` and `KEYCLOAK_ADMIN_PASSWORD`), the realm
data on the named volume `keycloak-data`, the theme folder bind-mounted **read-only**, so editing
the CSS in the repo and refreshing the browser is the whole development loop.

**Before you move over from the old container, export its realm** (Admin console, realm
`cricketlegend`, Realm settings, Action, Partial export, include clients and groups/roles), then
import it into the new one. The compose file starts an empty Keycloak. Stop the old container
first or change `KEYCLOAK_PORT`: both want 8180.

### C. A throwaway Keycloak just for looking at the theme

```
docker run -d --name kc-theme-test -p 8190:8080 \
  -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin \
  -v "$PWD/keycloak/themes/cricketlegend:/opt/keycloak/themes/cricketlegend:ro" \
  quay.io/keycloak/keycloak:24.0.3 start-dev
```

Remove it with `docker rm -f kc-theme-test` when done. It never touches your real realm.

## Choose the theme in the realm

Admin console, realm, **Realm settings, Themes, Login theme: `cricketlegend`, Save.** (From the
command line: `kcadm.sh update realms/<realm> -s loginTheme=cricketlegend`.) Then walk the
"Login theme and realm checklist" in `docs/deployment.md`: several pages only appear when the
realm switch behind them is on (Remember me, Forgot password, User registration, social
providers), and a few need a realm setting for the wording to be right.

## Look at every page

With a test realm: Forgot password and the email it sends (point the realm's Email settings at a
local sink such as Mailpit on port 1025), a wrong password, an expired page (open the sign-in
page, wait or submit a stale tab), registration (turn User registration on), the required
actions (give a test user Verify Email, Update Password, Update Profile, Terms and Conditions or
Configure OTP; enable Terms and Conditions under Authentication, Required actions first), a
disabled user, logout confirmation, and a Google button (add a dummy Google identity provider,
only to see the button). Check each at 375 and 1280 px.

## Upgrading Keycloak

The theme extends the stock `keycloak` login theme of **24.0.3**, the version the platform runs.
On an upgrade: diff the two overridden `.ftl` files against the new stock ones, rerun the page
walk above, and re-check the checklist in `docs/deployment.md`.

## Packaging and deployment

```
keycloak/package.sh
```

writes `keycloak/dist/cricketlegend-login-theme.zip` (unzip into `/opt/keycloak/themes/`, then
restart Keycloak or let its theme cache expire; no `kc.sh build` needed) and
`cricketlegend-login-theme.jar` (a theme provider JAR for `/opt/keycloak/providers/`, which does
need `kc.sh build`). CI builds both on every run (`keycloak-theme` job in
`.github/workflows/ci.yml`) and keeps them as the `cricketlegend-login-theme` artifact. Rolling
the theme out or back needs no backend or UI deployment.

## Per-club branding (documented, not built)

Platform branding only for now (spec 119, Decision 22). For later: the SPA adds a `club=<slug>`
parameter to the login URL (`ui/src/auth/keycloak.ts`), the theme reads it and sets the same CSS
custom properties from `GET /api/v1/public/branding?slug=`. Constraints for that spec: the fixed
token set only (`001` ADR-05), fall back to platform branding for an unknown slug, no club data
beyond what `/public/branding` exposes.

## Rules for changing the theme

- Mobile first: base CSS is the phone layout, wider layouts use `min-width` queries (480, 768).
- Keep `parent=keycloak` and both stylesheets in `theme.properties`, so the stock styles stay.
- Keep control borders at `--cl-edge` (`#8A7F5E`, 3:1 contrast), the 3 px gold focus ring, and the
  `forced-colors` and `prefers-reduced-motion` blocks at the end of the stylesheet.
- No request to any host but the auth host: no CDN fonts, no analytics, no remote images.
- Fonts are SIL OFL; the licence texts sit next to the files. Add a font only from its official
  source and treat the download as untrusted.
