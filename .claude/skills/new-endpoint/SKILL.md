---
name: new-endpoint
description: Scaffolds a new backend endpoint (Controller + Service + Repository + DTO + Mapper) matching docs/standards/backend.md's skeleton, after checking for reusable existing logic. Use when asked to add an API endpoint.
---

1. Search `backend/src/main/java/com/cricketlegend/service/` and `.../repository/` for existing logic that already covers part of the need (a `Specification`, a mapper, a validation helper) — reuse it rather than duplicating.
2. Scaffold, following `docs/standards/backend.md`'s class skeleton exactly:
   - `controller/<Name>Controller.java` — thin, `@PreAuthorize`, DTO in/out only.
   - `service/<Name>Service.java` (interface) + `service/impl/<Name>ServiceImpl.java`.
   - `repository/<Name>Repository.java` if a new one is genuinely needed.
   - `dto/<Name>Dto.java`, `dto/Create<Name>Request.java` as needed (flat `dto` package, no subpackages).
   - `mapper/<Name>Mapper.java` — MapStruct interface, `componentModel = "spring"`.
3. Add a unit test for the service method and, if a new repository query exists, an integration test extending `com.cricketlegend.AbstractIntegrationTest`.
4. If the endpoint needs a new business exception, add it to the exception table in `docs/standards/backend.md` first.
