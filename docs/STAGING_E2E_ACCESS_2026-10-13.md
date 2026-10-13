# Staging E2E access — 2026-10-13

Candidate: `65d5f8ac8284e495bd95d742172da11f6a25b782`, deployment `dpl_6oqdS1C4pkSNHAN3fLEvoNz8yPZf`, immutable URL `https://orkto-staging-fgfh3m49v-peixoto-s-projects1.vercel.app/`.

## Executed evidence

| Scenario | Expected | Observed | Result |
| --- | --- | --- | --- |
| TARGET_IDENTITY | Exact staging project, SHA and READY Preview | CLI inspect plus project-ID-scoped list confirmed all three | PASS |
| OIDC_INJECTION | Live development token, memory only | `vercel.cmd env run` in clean staging-linked checkout injected a usable token | PASS |
| PREVIEW_ROOT | Protected candidate opens with OIDC | HTTP 200 application response | PASS |
| HEALTH | App health on exact candidate | HTTP 200 application response | PASS |
| READINESS | App readiness on exact candidate | HTTP 200 application response | PASS |
| BROWSER_ACCESS | Playwright reaches application login | Chromium navigation HTTP 200; application Entrar button visible | PASS |
| PUBLIC_SUPABASE_TARGET | Compiled public config targets staging | Only staging Supabase URL found in inspected entry scripts; no service-role JWT detected there | PASS |
| PUBLIC_AUTH_KEY | Candidate public key accepted by staging Auth | `/auth/v1/settings` HTTP 200; key not printed or retained | PASS |
| STAGING_LEDGER | 41 current migrations | Authenticated read-only SQL count = 41 | PASS |
| ADMIN_INJECTION | Staging-only administrative credential in parent | Absent from process; absent from staging runner variables in existing local env files; repository/environment GitHub secret name lists empty | BLOCKED |
| AUTH_AB_AND_ISOLATION | Real login A/B, own data and cross-workspace denial | Runner exited before user creation with `SECURE_STAGING_ADMIN_KEY_REQUIRED` | BLOCKED |
| BUSINESS_BROWSER_E2E | Core UI, gateway, WIA, approvals and audit exercised by A/B | Not run because prerequisite administrative fixture bootstrap is blocked | BLOCKED |

Initial OIDC attempt used the main checkout. CLI 55.0.0 loads local `.env.local` and `.env` over freshly fetched variables; a pre-existing expired OIDC token won that merge. The local legacy Supabase keys were classified as production and rejected without using them or printing their values. Repeating in the existing clean worktree `Orktoverdeiro-deploy-6bc8adb` resolved OIDC; no SSO change or share link was needed. This worktree supplies only the linked-project/OIDC environment; the current runner and Playwright files are loaded by absolute path from the source checkout.

The Supabase MCP account is authenticated and supports SQL inspection, but its available key tool exposes publishable/anon keys, not an administrative credential for the Node runner. Management/SQL access is not an Auth Admin API key. No SQL password rewrite, key extraction through an Edge endpoint, or production credential reuse was attempted.

## Reproduce access without credentials on disk

From PowerShell in the source checkout:

```powershell
$env:NODE_USE_SYSTEM_CA = '1'
Push-Location 'C:\Users\sobooa7iqytvqheo\Documents\Codex\Orktoverdeiro-deploy-6bc8adb'
try {
    & vercel.cmd env run -- node 'C:\Users\sobooa7iqytvqheo\Documents\Codex\Orktoverdeiro\scripts\readiness\probe-staging-preview-access.mjs'
} finally { Pop-Location }
```

Probe only performs GETs and a Chromium navigation, does not persist tokens, and scopes the OIDC header to the immutable candidate origin. Signature and Trusted Sources acceptance are verified by Vercel. The launcher refuses local env files, pins the project/ref/SHA, and strips unrelated inherited credentials.

## One owner action

In a private local PowerShell terminal, run:

```powershell
& 'C:\Users\sobooa7iqytvqheo\Documents\Codex\Orktoverdeiro\scripts\readiness\run-staging-auth-secure.ps1'
```

Enter the **staging** project `ghrjongiodziasupakrk` admin/secret key and publishable/anon key directly into the two masked prompts, obtained from that project's Supabase Settings → API Keys. Do not send them through chat or write them to `.env`, code, Vercel Preview or artifacts. The launcher verifies the staging target and Auth Admin API acceptance, then the existing runner creates/rotates only synthetic A/B accounts and launches the suite automatically. Opaque keys receive a local integrity fingerprint; the live Admin API check provides project acceptance evidence. The administrative key is withheld from the browser child. This remains an administrative staging test credential, not an application runtime requirement.

## Scope and counts

Seven access-probe checks passed on the candidate: token injection, root, health, readiness, public target, public Auth acceptance and browser access. Deployment identity and ledger were checked separately. Authenticated A/B scenarios: **0 executed**, **0 PASS**, **0 FAIL**, **2 blocked groups** (Auth/isolation and business E2E); these are not evidence of application failure or successful isolation. Focused runner tests: **17/17 PASS**. Full regression was not repeated. No production mutation, billing, messaging, paid provider call or staging data mutation occurred.

`READY_FOR_PRODUCTION_CANDIDATE=NO`.
