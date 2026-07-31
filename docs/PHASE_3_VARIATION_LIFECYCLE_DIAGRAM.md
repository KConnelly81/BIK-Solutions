# Variation Notice — Complete Lifecycle

**Purpose:** One-page reference for the full Variation workflow — what's already built, what's newly built this phase, and what's still a real gap. Requested alongside the concurrency-safe number generator (`011`), before frontend integration begins.
**Owner:** BIK Solutions Pty Ltd
**Status:** Reference diagram, current as of 2026-07-31.

This is the shape of the thing the user's earlier framing named directly: not a data migration, but the first connection of Authentication, Organisation, Projects, Variation Notice, AI Writer, PDF, and (eventually) Email into one workflow. The diagram below shows exactly which of those seven are already connected, which are new database work from this phase, and which remain to be built.

```mermaid
flowchart TD
    classDef built fill:#e3f2e5,stroke:#2b9e3f,color:#1f6b2a,stroke-width:1.5px
    classDef newschema fill:#dbe9fa,stroke:#2c7dd4,color:#1a4d80,stroke-width:1.5px
    classDef notbuilt fill:#fbe9d8,stroke:#e67e22,color:#8a4a10,stroke-width:1.5px,stroke-dasharray:5 4

    A["Sign in<br/>Supabase Auth"]:::built --> B["Dashboard: pick or<br/>create a Project"]:::built
    B --> C["Open Variation Generator<br/>for this Project"]:::notbuilt
    C --> D["Load Project + Client<br/>from Supabase"]:::notbuilt
    D --> E["Copy details into the<br/>variation form (one-time)"]:::notbuilt
    E --> F["Fill in reason, description,<br/>cost, time impact, terms"]:::notbuilt
    F -.optional.-> G["AI Writer assist<br/>rewrite / strengthen wording"]:::built
    G --> F
    F --> H["Save Draft"]:::notbuilt
    H --> I["INSERT variation_notices<br/>number auto-assigned atomically<br/>(011, concurrency-safe)"]:::newschema
    I --> J{"Ready to issue?"}
    J -- "keep editing" --> F
    J -- yes --> K["Issue"]:::notbuilt
    K --> L["status → issued<br/>issued_snapshot frozen atomically<br/>(010)"]:::newschema
    L --> M["Print‑to‑PDF<br/>native browser export"]:::built
    M --> N["Email PDF to client"]:::notbuilt
    N --> O{"Client response"}
    O -- approved --> P["status → approved"]:::notbuilt
    O -- "rejected / changes needed" --> Q["Reset to Draft"]:::notbuilt
    Q --> F
    P --> R["Archive<br/>(status → archived, ADR‑010)"]:::notbuilt

    S["Every step above is organisation‑<br/>and project‑scoped by RLS (005) —<br/>a second organisation cannot see or<br/>touch another's variation notices."]
    style S fill:transparent,stroke:#888780,color:#3A3835,stroke-dasharray:3 3
```

## Legend

| | Meaning |
|---|---|
| 🟢 **Built** | Already live today, unaffected by this migration — Supabase Auth (Phase 2), `app-dashboard.html` project picker (Phase 2), AI Writer (Cloudflare Worker proxy), native print-to-PDF (`js/toolkit/exporter.js`, ADR-007). |
| 🔵 **New this phase** | Database work completed/drafted in this session — `variation_notices` (010, applied live), the concurrency-safe number generator (011, drafted), `issued_snapshot` capture, tenant isolation. |
| 🟠 **Not yet built** | Real gaps — every step of connecting the Variation Generator *UI* to this backend (still `localStorage`-only today), and the email-to-client capability, which doesn't exist anywhere in the codebase yet. |

## Why this shape, specifically

- **The Draft ⇄ Save loop (F → H → I → J → F) is unlimited.** A variation can be edited and re-saved any number of times while in draft — nothing about the schema restricts this, and `issued_snapshot` stays `null` throughout (verified, see `docs/PHASE_3_VARIATION_NOTICES_SCHEMA.md`).
- **The moment it matters is Issue (K → L).** That's where `variation_number` (if not already manually set) gets its final, collision-free value and `issued_snapshot` freezes — the two pieces of database work this phase specifically hardened, because that's the exact moment a Variation Notice stops being a draft and becomes a document of record, "exactly how accounting systems behave."
- **Reset-and-reissue (Q → F → ... → L) is a real, supported path, not an edge case.** A rejected variation can be corrected and re-issued; the snapshot correctly refreshes to the new issue event each time (verified under both local and live testing).
- **PDF is a carry-over, not new work.** The existing document engine already does native browser print-to-PDF for every tool (ADR-007) — Variation Notice gets this for free once wired up, the same as every other tool built on `js/toolkit/engine.js`.
- **Email is the one genuinely new capability with no existing foundation anywhere in the codebase.** Worth naming explicitly rather than letting it hide inside "wire up the frontend" — it's a different kind of work (an outbound email integration) from the rest of this list.
