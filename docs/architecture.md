# Architecture — Identity, Tenancy & Auth

A living map of how a human becomes a `Person`, how that `Person` relates to a `Club`, and how login (Keycloak) fits in. Not a spec — it doesn't gate implementation and carries no requirements of its own. Update it whenever a spec changes `Person`/`Contact`/`RoleAssignment`/`Club`/`Subscription`'s shape or relationships, the same living-doc discipline `docs/roadmap.md` already follows. Each diagram notes what's actually built today vs. what a named, still-unscoped future spec owns — don't let this file imply something exists before it does.

## Data model — how the pieces relate

```mermaid
erDiagram
    PERSON ||--o{ SUBSCRIPTION : "is responsible for"
    PERSON ||--o{ ROLE_ASSIGNMENT : holds
    CLUB ||--o{ SECTION : contains
    SECTION ||--o{ SECTION : "parent of"
    CLUB ||--o{ SUBSCRIPTION : "may own"
    SECTION ||--o{ SUBSCRIPTION : "may own"
    CLUB ||--o{ ROLE_ASSIGNMENT : "scopes (optionally)"
    SECTION ||--o{ ROLE_ASSIGNMENT : "scopes (optionally)"
    CLUB ||--o{ CONTACT : "has many (future — Club Contacts, unscoped)"

    PERSON {
        uuid id
        string first_name
        string last_name
        string email "unique, case-insensitive"
        string phone "nullable"
        string keycloak_user_id "nullable — set once this Person logs in"
    }
    CLUB {
        uuid id
        string name
        string slug
    }
    SECTION {
        uuid id
        uuid club_id
        uuid parent_section_id "nullable"
        string name
    }
    SUBSCRIPTION {
        uuid id
        string owner_type "CLUB or SECTION"
        uuid owner_id
        uuid product_id
        uuid responsible_person_id
        string status
    }
    ROLE_ASSIGNMENT {
        uuid person_id
        string scope_type "GLOBAL, CLUB, or SECTION"
        uuid scope_id "nullable for GLOBAL"
        string role
    }
    CONTACT {
        uuid club_id "future — not built yet"
        string first_name
        string last_name
        string email
        string phone "nullable"
        string role "e.g. Chairman, Treasurer"
        boolean is_primary
    }
```

- **`PERSON`** — global, one row per human, forever (`001-tenancy-identity-model.md`). The only entity a Keycloak login ever attaches to.
- **`ROLE_ASSIGNMENT`** — the administrative-capability grant, scoped to `GLOBAL`/`CLUB`/`SECTION`. Named in `001`, **not yet built** anywhere in code.
- **`CONTACT`** — a named point of contact *for a Club* (chairman, treasurer, groundskeeper...), **not built yet** (the "Club Contacts" spec, `docs/roadmap.md`). One `Club` has many `Contact` rows — a real, ordinary foreign key, same shape as `Club` → `Section`. No inherent login capability.
- `SUBSCRIPTION.responsible_person_id` (`014`) is the first real edge from `PERSON` to the rest of the tenancy model — a `Person` gets linked to a `Club` today by being accountable for its `Subscription`, well before any login or role exists.

**The one relationship that's genuinely *not* in this diagram: `Contact` → `Person`.** Unlike `Contact`'s very real FK to `Club` above, it never gets a foreign key to `Person` — that link, when it exists at all, is resolved at runtime by matching email addresses, not stored in the schema. See the flowchart below for exactly how and when that happens.

## Login — resolving a request back to a `Person`

```mermaid
sequenceDiagram
    participant U as Browser (riverside.yourapp.com)
    participant KC as Keycloak (auth.yourapp.com)
    participant API as Backend API
    participant DB as Postgres (person / role_assignment)

    U->>KC: Log in (redirect, PKCE) — 002-realm-subdomain-auth.md
    KC-->>U: access_token (sub = Keycloak user id)
    U->>API: Request, Authorization: Bearer
    API->>DB: SELECT * FROM person WHERE keycloak_user_id = sub
    DB-->>API: Person row (id, first_name, last_name, email...)
    Note over API,DB: RoleAssignment lookup — what this Person can do<br/>in this Club/Section's scope (001, not yet built)
    API-->>U: Response, scoped to this Person's identity and roles
```

One shared Keycloak realm across every club (`002`) — the subdomain picks which club's data a request is scoped to, not which realm handles the login. `sub` (the Keycloak user id) is the only thing that ever maps to `Person.keycloak_user_id`; nothing else identifies a logged-in human.

## How a human becomes a `Person` — today vs. what's next

```mermaid
flowchart TD
    subgraph today["Today — built (014)"]
        A["Platform admin creates a Subscription"] --> B["Types responsible party's<br/>first/last name, email, phone"]
        B --> C{"PersonService.findOrCreatePerson(email)"}
        C -->|"email matches an existing Person"| D["Link to that Person —<br/>existing name/phone win, not what was typed"]
        C -->|"no match"| E["Create a new Person row<br/>keycloak_user_id = null"]
        D --> F["Subscription.responsible_person_id"]
        E --> F
    end

    subgraph future1["Future — self-serve signup (unscoped, docs/roadmap.md)"]
        G["Person registers via self-serve signup"] --> H["Keycloak account created"]
        H --> I{"Same PersonService.findOrCreatePerson(email)"}
        I -->|"email already has a Person<br/>e.g. from a Subscription above"| J["Same Person row —<br/>keycloak_user_id set on it"]
        I -->|"brand new email"| K["New Person, then<br/>keycloak_user_id set"]
    end

    subgraph future2["Future — Club Contacts (unscoped, docs/roadmap.md)"]
        L["Club Contact added —<br/>name/email/phone, no login"] -.->|"if ever upgraded to need login,<br/>same email bridge, never a schema FK"| C
    end

    F --> M["Person is linked to a Club today —<br/>via the Subscription it's responsible for"]
    J --> N["Person can log in.<br/>RoleAssignment (001, not yet built)<br/>decides what they can do"]
    K --> N
```

**The load-bearing idea:** `PersonService.findOrCreatePerson(email)` is the one resolution point every door into `Person` goes through — a Subscription's responsible party today, self-serve signup tomorrow, a Club Contact's optional login upgrade whenever that's needed. Email is the only key that bridges them; none of these paths ever gain a schema-level FK to each other. A human can arrive at the same `Person` row through any of these doors without the system ever creating a duplicate identity.

**What none of this grants by itself:** a `Person` existing — through any path above — implies zero login and zero administrative capability on its own. Login only exists once `keycloak_user_id` is actually set (self-serve signup, unbuilt). Administrative capability only exists once a `RoleAssignment` row exists (`001`, unbuilt). Both are separate, later, deliberate grants — see `014`'s Non-goals for why this spec stops short of either.
