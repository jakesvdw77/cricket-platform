# 160: Login Audit Log (Administration Console)

**Depends on:** `002-realm-subdomain-auth.md` (one shared realm, Keycloak is the identity store), `005-admin-login.md` (the platform admin role), `016-keycloak-account-provisioning.md` (the backend's Keycloak admin client).
**Status:** approved 2026-11-17 but deferred by the owner the same day: the Keycloak console (Realm settings, Events, Save events on; Events and Sessions menus) is enough for now. Build this page only if the console log proves too limited. Open questions were answered (all as recommended).

## Problem & Goals
There is no way to see who has signed in. Every sign-in and sign-out happens in Keycloak and leaves nothing the platform can show. The owner needs to see, in the administration console, **who signed in and out, and when**, to follow up on people who never log in and to answer "did they get the invitation and use it?".

**Goals**
- A **Login Audit** page in the administration console: newest first, one row per sign-in, sign-out or failed sign-in.
- **Always server-side paginated** (**Decided**). The page never loads the whole log; page size 25 by default, 50 at most.
- Filters: event type, date range, and a search by email or name.
- Each row shows the person (name and email), the club(s) they belong to, the event, the time, and the IP address.

## Non-goals
- Not a general audit of what people did in the application (edits, deletes). Sign-in and sign-out only.
- No export, alerting or "suspicious login" detection.
- No editing or deleting of the log from the application.
- Club managers do not see this in v1 (see Open Questions).
- Idle-session timeouts are not logged as sign-outs: Keycloak raises no sign-out event when a session simply expires, so a person who closes the tab shows a sign-in and no sign-out. The page says so under the table.

## Approach (recommended)
Keycloak already knows every login and logout; it only needs to be told to **keep** them. So no new table, no listener plug-in and no change to the sign-in flow:
1. **Switch on event storage** for the shared realm: event types `LOGIN`, `LOGOUT`, `LOGIN_ERROR`; **expiration 90 days** so the log cannot grow without bound. This is a one-time realm setting (a realm export entry for new environments, and a manual change on production through the Keycloak console).
2. The backend reads Keycloak's events through the admin client it already has (`GET /admin/realms/{realm}/events` with `type`, `dateFrom`, `dateTo`, `user`, `first`, `max`). The service account needs the `view-events` role.
3. The backend joins each event's Keycloak user id to a `Person` (`keycloak_user_id`) to show the name and the club(s), and falls back to the username in the event when there is no match (for example the platform admin).

**Paging.** Keycloak returns a window (`first`, `max`) and no total. The API asks for one row more than the page size to know whether there is a next page, so the page has **Previous / Next** and "Showing 26 to 50", and never a "page 1 of N" or a total. Filters and the page are query parameters, so a page can be bookmarked.

**Why not a table of our own?** A `login_event` table filled by a Keycloak event-listener plug-in would give totals, longer retention and joins in SQL, at the price of a custom jar deployed into Keycloak and kept in step with Keycloak upgrades. Not worth it for a log read by one person; it can replace the source later without changing the page or the endpoint.

## API
- `GET /api/v1/platform/login-events?type=&from=&to=&q=&page=&size=` (platform admin only, the same guard as the other `/platform` endpoints).
- Response: `{ items: [{ occurredAt, event: LOGIN|LOGOUT|LOGIN_FAILED, personName, email, clubs: [name], ipAddress }], page, size, hasNext }`.
- `q` is matched against the email or username in Keycloak (its `user` filter takes an id, so the service resolves the typed text to user ids first, capped at 20 matches).
- No write endpoints. `openapi.yaml` gains the path and schema.

## UI (follows `docs/standards/page-anatomy.md`)
A **Login Audit** entry in the Administration menu. The page: figure cards for Sign-ins today, Sign-outs today and Failed sign-ins today (this window only, counted from the first page of that day's events), the shared filter toolbar (Event segmented control: All, Sign-ins, Sign-outs, Failed; date range; search), then the list: records on a phone, a table on a desktop. Time is shown in the club's local time (South Africa) with the date. Empty state: "No sign-ins in this period". Previous and Next in the table footer. Shared compact `Button`, Title Case, no raw MUI.

## Privacy
Names, emails and IP addresses are personal information. Only the platform admin can see them. The 90-day expiry is the retention rule. The page and the realm setting are described in the privacy notes when they are next updated.

## Test Plan
- **Backend unit:** the paging (the extra row decides `hasNext`, size capped at 50), joining the Keycloak user to the person and clubs, the fallback to the event's username, the search resolving to user ids, an unknown event type ignored.
- **Backend integration:** the endpoint is refused for anyone who is not the platform admin; the Keycloak client is a fake.
- **Frontend:** the filters change the query, Next and Previous move the page, the empty state, the phone cards.
- **Manual:** sign in and out as a test user locally and see both rows; sign in with a wrong password and see the failed row.

## Rollout Notes
No migration. The deploy is an image pull plus two Keycloak changes: switch on event storage (90 days) and give the backend's service account `view-events`. **Events are only stored from the moment the setting is switched on**, so there is no history before it; switch it on as the first step.

## Decisions (owner, 2026-11-17)
1. **Who sees it:** the platform admin only. Club managers later, if wanted.
2. **Failed sign-ins:** included.
3. **Retention:** 90 days.

## Later
4. **Last sign-in on the People list:** a "Last Signed In" column on the players and managers lists is easy to ask for later but needs the platform to keep its own copy (Keycloak cannot return "last event per user" cheaply). Not in this spec.
