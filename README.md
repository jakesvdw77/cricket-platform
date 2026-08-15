# Cricket Legend Platform

Multi-club cricket management system — Spring Boot backend, React/TypeScript frontend, sold to and white-labelled per club.

See `CLAUDE.md` for the full governance model, and `docs/specs/` for the architecture this repo is built against.

## Local development

```bash
# Backend — expects Postgres on localhost:5432 (db cricketlegend_platform)
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# Frontend — Vite on :5173, proxies /api to :8081
cd ui && npm install && npm run dev
```

Run `cd backend && ./mvnw test` / `cd ui && npm run build && npm test && npm run lint` before opening a PR — see `docs/standards/testing.md`.
