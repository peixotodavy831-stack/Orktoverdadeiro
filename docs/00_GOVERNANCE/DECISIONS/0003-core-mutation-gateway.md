# ADR 0003 — Core mutations through explicit Supabase commands

Date: 2026-10-03
Status: Accepted for staging client mutations; expansion pending

## Decision

The browser and Vercel Preview use a Supabase publishable key, Auth JWT and RLS. Protected core tables keep direct `authenticated` writes revoked. A product Supabase Edge Function accepts only named commands. It validates the current JWT with Supabase Auth, resolves active workspace membership and role, checks plan access and validates the command payload. It uses the project's own service-role credential solely inside the Edge runtime to call a narrowly granted, service-only database function. The database function repeats membership and resource checks and writes the entity and audit event in one transaction with a durable idempotency key.

The first commands are `CREATE_CLIENT`, `UPDATE_CLIENT`, `ARCHIVE_CLIENT`, `CREATE_CATALOG_ITEM`, `UPDATE_CATALOG_ITEM` and `ARCHIVE_CATALOG_ITEM`. The staging project is `ghrjongiodziasupakrk`. No production deployment or schema change is part of this decision's implementation.

## Why

An Express route with a public key and user JWT cannot write a table whose authenticated grant is revoked. Granting a broad table write would let callers bypass backend validation, plan checks and audit through PostgREST. A named command boundary retains the direct-write denial and does not place the service-role key in Vercel Preview.

## Constraints

- Every new command needs its own payload schema, permission, same-workspace resource check, idempotency decision and audit contract.
- The Edge endpoint is not generic CRUD, a SQL executor, or a temporary administrative bootstrap.
- The database RPC is executable by `service_role` only; `PUBLIC`, `anon` and `authenticated` cannot execute it.
- A caller-supplied workspace is only a selector. The effective workspace comes from a checked active membership; client payloads cannot set privileged columns.
- The frontend never treats an accepted external request as provider delivery. Billing, messaging and paid providers remain disabled until their separate execution boundaries are validated.
- Preview and production use the same architectural pattern, but this change was deployed only to staging and is not production approval.

## Verification and limits

The staging Auth A/B probe verified client and catalog CREATE/UPDATE/ARCHIVE, cross-workspace denial, foreign ID denial, audit, idempotent replay, and denial of direct table writes. The local API bridge passed against staging without an elevated Vercel key. Other core writes are still blocked or unverified; [the mutation matrix](../../05_ENGINEERING/ORKTO_CORE_MUTATION_MATRIX.md) tracks them.
