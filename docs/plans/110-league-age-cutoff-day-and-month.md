# Plan: 110: League Age Cut-off as a Day and Month

Spec: `docs/specs/110-league-age-cutoff-day-and-month.md` (approved 2026-10-16).

1. **Backend (backend-builder):** migration 049; `League`, DTOs, requests, mapper, `LeagueServiceImpl` validation; `LeagueAgeReference` (one class, in `service/support`) with the earliest-active-match lookup (batched for the batch rules); `SelectionEligibility` (both places) and `TeamSelectionBatchRules` use it; `LeagueCopyRules`; the age-reference-date endpoint and `AgeReferenceDto`; messages; `openapi.yaml`; tests as in the spec.
2. **Frontend (frontend-builder):** `leagueApi` types, `LeagueForm` day and month inputs and the 31 December default, league view and edit page lines, API call for the reference date.
3. **After PR #126 merges:** adapt `birthDateWindow` and the New player tab to use the endpoint's date.
4. **Docs.**

Rules: no new library; UK spelling; no em dashes; backend tests only in a scratch copy; work in the worktree `scratchpad/wt110`.
