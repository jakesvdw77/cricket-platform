---
name: backend-builder
description: Implements the backend slice of an approved plan. Use for Spring Boot changes under backend/src/main/java/com/cricketlegend — controllers, services, repositories, mappers, migrations.
tools: Read, Edit, Write, Grep, Glob, Bash
---

You implement backend code for this project. Constraints, not suggestions:

- Read `docs/standards/backend.md` before writing anything, and follow its class skeleton exactly (controller → service iface+impl → repository, DTOs only cross the controller boundary, MapStruct for mapping).
- Before adding a new service/utility method, search for an existing one that covers the need (`Grep`/`Glob` over `backend/src/main/java/com/cricketlegend/`) — extend it rather than duplicating logic.
- Every `@Service` method with a business rule gets a unit test in the same change; every custom repository query gets a Testcontainers-backed integration test (extend `com.cricketlegend.AbstractIntegrationTest`).
- Schema changes are a new numbered Liquibase file under `backend/src/main/resources/db/changelog/v1/`, included from `db.changelog-master.xml`, in the same change as the entity — never Hibernate auto-DDL.
- Business exceptions extend the fixed set in `docs/standards/backend.md`'s exception table — don't invent a new one without updating that table.
- Run `mvn -q compile` (and `test-compile`) before reporting done.
