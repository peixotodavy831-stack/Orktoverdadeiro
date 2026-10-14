# Próxima execução preparada — c1660be

O wrapper agora usa por padrão https://orkto-staging-fl4uvx2qw-peixoto-s-projects1.vercel.app/ e SHA c1660be6081da10fa8eda4c2afb4baccb51ed4fa; mostra o SHA antes dos prompts privados. A versão corrigida tem cinco casos. Chaves entram somente nos prompts mascarados, permanecem no processo administrativo e são apagadas ao sair; não entram no browser ou Vercel Preview. TLS permanece verificado; OIDC é novo e em memória.

A execução ampliada anterior usou 65d5f8a porque o comando omitiu parâmetros e falhou em duas assertions do harness. Elas foram corrigidas (list item único e serviceRunId persistido). Logout/revogação e role negatives passaram no candidato antigo; isso não aprova o novo. A prova 2/2 original continua preservada. O launcher pronto ainda requer entrada privada pelo proprietário, pois o agente não dispõe dessas chaves. Comando completo e decisão de senhas vazadas: [backlog consolidado](05_ENGINEERING/ORKTO_HUMAN_ACTION_BACKLOG.md).

---

# Staging E2E access — 2026-10-13

## Current follow-up: authenticated runner executed

The owner supplied staging credentials privately to the masked launcher. The first measured browser test failed on an ambiguous contact-name locator after successful contact creation; it was incorrectly labelled TIMEOUT. After correcting operation identity and classification, the same-candidate repeat passed **both configured browser tests (2/2)**: health/readiness and Auth A/B/navigation/mutations/isolation. The main scenario took 70,407 ms without changing the 90 s limit. Parent Auth/RLS A/B and cleanup passed; independent staging SQL confirmed zero sessions/refresh tokens. A browser Supabase logout network failure remains in the diagnostics, with transport cause unverified; final global revocation was verified separately. See [the measured diagnosis and final evidence](STAGING_RUNNER_TIMEOUT_2026-10-13.md). Failure traces retain sanitized timelines only; disabled-trace/admin-blocked descriptions below record earlier states. This does not approve every product or release-security gate.

## Follow-up: TLS and credential containment

The owner's actual A/B run reached Playwright but both tests failed TLS. The former child-environment whitelist dropped `NODE_USE_SYSTEM_CA`; this is now propagated explicitly, and optional `NODE_EXTRA_CA_CERTS` must name an existing absolute CA file. Insecure overrides are rejected. The corrected child performed two GETs on this exact candidate: health and readiness both 200, system CA active, admin key absent. No custom CA was needed for those requests.

Raw Playwright output is now captured in memory; the parent forwards only allowlisted test IDs/statuses/error classes. A safe fixture redacts known credentials before Playwright writes error context; a custom reporter withholds unstructured error artifacts altogether, and the parent repeats containment even after crashes/timeouts. This also covers unknown opaque secrets that regex cannot recognize. Only allowlisted last-run status/IDs are retained. Screenshots, traces and video are withheld; unreviewed binary artifacts are removed. Old local error-context files were replaced with safe withholding markers and scanned (3 files, zero findings). This does not erase a terminal transcript or copies previously retained outside this checkout.

The exposed synthetic Auth session was globally signed out through staging Auth (HTTP 204). SQL afterwards found zero sessions/refresh tokens for both reserved synthetic users. Issued access JWTs are stateless and may remain usable until expiry; sign-out is not an immediate cryptographic revocation. OIDC was minted anew and the leaked token was not reused; no team signing-key change or deployment-protection modification was attempted. The parent now globally signs out synthetic users after browser success/failure as well.

Security fixtures passed locally: child CA propagation/admin isolation, override rejection, text redaction, live TLS trust/hostname tests, deliberate Playwright failures without credential retention, and old artifact sanitation. The full corrected A/B suite is **NOT RUN**; use the same masked launcher command below for the single next attempt. These changes affect runners/tests only; the candidate application SHA/deployment remains unchanged.

A stricter regression initially found an opaque fixture value retained because the reporter read nonexistent `result.outputDir`. The reporter now obtains the actual project output directories from `onBegin(config)`; the same regression passed after correction. No test was removed or weakened. Typecheck passed; the focused scan of changed files and contained artifacts reported 14 files/zero findings.

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
