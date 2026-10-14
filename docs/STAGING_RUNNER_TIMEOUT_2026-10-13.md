# Secure staging runner — failure diagnosis (2026-10-13)

## Candidate and limits

Application SHA `65d5f8ac8284e495bd95d742172da11f6a25b782`, deployment `dpl_6oqdS1C4pkSNHAN3fLEvoNz8yPZf`, immutable staging URL `https://orkto-staging-fgfh3m49v-peixoto-s-projects1.vercel.app/`. Supabase target `ghrjongiodziasupakrk`. No application deployment, production operation, migration, real communication or payment is part of this fix.

Limits unchanged: Playwright test 90 s, assertion/action 15 s, navigation/API request 30 s, child process 15 min, Vercel inspect/list 60 s each. No certificate-validation bypass or added test retry.

## Origin and cause

`id/status/errors` JSON is emitted by `staging-safe-reporter.mjs:onTestEnd` and projected again by the parent. The ID is SHA-256 of `titlePath()` truncated to 16 hexadecimal characters. Native `.last-run.json` uses different Playwright IDs; its failed ID mapped to the entire Auth A/B scenario, not an individual request. The earlier error classifier matched the word `Timeout` anywhere in a diagnostic, including a configured assertion timeout printed next to a strict-mode error.

The earlier minimal report discarded operation context. Its exact operation cannot be recovered from those old artifacts. A new owner-run of the safe launcher reproduced the failure with duration/line evidence:

| Stage | Result | Duration |
| --- | --- | --- |
| Preview identity | PASS | 10,063 ms |
| Staging key acceptance | PASS | 1,065 ms |
| Synthetic users / workspaces | PASS | 509 / 1,284 ms |
| Fixtures A / B | PASS | 7,104 / 5,559 ms |
| Auth/RLS A / B | PASS | 9,932 / 9,129 ms |
| Health/readiness browser test | PASS | 2,560 ms; HTTP 200 / 200 |
| Browser Auth A | PASS | 8,346 ms |
| Workspace/Inbox A | PASS | 4,219 ms; read/replay/status HTTP 200 |
| Client/contact A | FAIL | `CREATE_CONTACT` HTTP 201, follow-up GET HTTP 200; visibility assertion at recorded line 236 failed in 930 ms |
| Full browser scenario | FAIL | 21,652 ms; parent process ended after 29,806 ms |
| Cleanup A / B | PASS | 573 / 499 ms |

The failing assertion was `expect(clientDialog.getByText('Contact A Synthetic', {exact:true})).toBeVisible()`. The fixture already creates that name, and the browser created it again. Read-only staging SQL found **three** such contacts for **one** customer in workspace A. UI rendering maps every contact to a paragraph and edit button with that display name. A dedicated Chromium reproduction with the same repeated names confirms `LOCATOR_AMBIGUOUS`, not elapsed request, authentication, polling or runner timeout. The 15,000 ms mentioned in the old error classification was the assertion's configured limit; neither the 90 s test budget nor 15 min process deadline was reached in this measured reproduction.

The test now generates a unique name for the new contact, requires exactly one matching visible contact and edits its exact accessible control. It retains returned-ID, ownership, mutation response, foreign-ID denial and refresh assertions. It does not select an arbitrary first contact or change product markup. The reporter classifies ambiguity before checking timeout text.

## Diagnostics and containment

- Parent phase durations cover identity, key acceptance, fixture/user/workspace preparation, Auth/RLS, Playwright exit and both cleanup operations. Safe phase data persists in `test-results/staging-runner.json`.
- Browser phase checkpoints and operation source lines identify the current stage. Request diagnostics retain only approved route, method, target classification, HTTP status, elapsed time and failure class; no headers, cookies, query values, payloads or response bodies.
- Streaming child output accepts only validated structured records; raw stdout/stderr is discarded.
- Failure traces retain a sanitized action/network timeline. Screenshots, DOM snapshots, source files, resources, headers, cookies, typed values, arbitrary IDs and raw errors are removed. Sanitization is repeatable. Failed timelines/records are archived under ignored `test-results/staging-e2e-failures/`, so a new Playwright run does not erase them.
- Global synthetic sign-out runs in `finally`, including failures before browser launch; both users are attempted and partial cleanup fails the runner. Post-run staging SQL confirmed **zero sessions and zero refresh tokens for A and B**. Stateless JWTs still expire according to Auth policy; sign-out is not instant cryptographic revocation.
- Administrative credentials remain in the trusted parent. Playwright receives synthetic credentials and Preview access in memory, plus the explicit system-CA settings. TLS remains verified.

## Validation state

Focused runner/security/identity tests: **26/26 PASS**. The actual Chromium fixture reproduces assertion ambiguity, rejects it, and passes the corrected unique-contact selection. It also deliberately exercises and distinguishes action, API request and whole-test deadlines. Separate parent-deadline test confirms `RUNNER_PROCESS`. Trust tests reject untrusted chains and invalid hostnames; an explicit trusted disposable CA succeeds. Known and opaque fixture credentials are absent from captured output and decoded final traces. Typecheck PASS. Full application regression was not repeated for this runner-only change.

First instrumented staging attempt: **health PASS, browser E2E FAIL**, pre-browser Auth/RLS A/B PASS, cleanup PASS. The corrected repeat through the masked launcher then completed on the **same candidate**:

| Final check | Result | Duration/evidence |
| --- | --- | --- |
| Deployment identity / staging keys | PASS | 11,162 / 1,426 ms |
| Parent Auth/RLS A / B | PASS | 8,109 / 7,593 ms |
| Health/readiness test | PASS | 1,062 ms; both HTTP 200 |
| Browser Auth A / B | PASS | 7,437 / 3,496 ms |
| Client/contact A | PASS | 8,332 ms; CREATE 201, UPDATE 200, persistence after refresh |
| Workspace isolation B | PASS | 6,443 ms; foreign contact/conversation 404; membership RPC derives own/foreign access |
| Gateway adversarial | PASS | 27,391 ms; catalog/deal/proposal own mutations, foreign-ID denial, idempotent replay, invalid token, spoofed workspace and feature gates |
| Direct table protection | PASS | INSERT/UPDATE/DELETE each 403 on eight protected tables |
| Configured browser suite | **2/2 PASS** | Auth A/B scenario 70,407 ms, within original 90,000 ms; Playwright exit 0 after 76,917 ms |
| Global session cleanup A / B | PASS | 622 / 519 ms; independent SQL again confirms zero sessions/refresh tokens each |

Persisted evidence: `test-results/staging-e2e/safe-results.json` and `test-results/staging-runner.json`. The first failed sanitized trace remains at `test-results/staging-e2e-failures/20261013-contact-collision/trace.zip`. These ignored artifacts are not release snapshots. No full-product E2E or formal release-security approval is implied beyond the assertions in the existing two-test suite.

One browser request to Supabase `/auth/v1/logout` was recorded as `NETWORK_ERROR`/status 0 during the A-to-B navigation. Its precise transport error was not retained; cancellation is not proven. The UI logout assertions passed; final global sign-out and independent zero-session SQL passed. The failed request is retained in the safe diagnostics, not hidden or claimed as a successful browser-side revocation. No same-origin application network failure, server error or page error failed the existing assertions.

Changed source/docs and final text artifacts passed secret scan; the archived real trace was separately decompressed/scanned and contained no credential matches. No raw header/body output is included in these records.

## Repeat safely

```powershell
& 'C:\Users\sobooa7iqytvqheo\Documents\Codex\Orktoverdeiro\scripts\readiness\run-staging-auth-secure.ps1'
```

Enter staging admin/public keys only in the private masked prompts. Do not place values in chat, files or Preview. The launcher pins the same candidate and obtains fresh OIDC from the clean staging-linked environment. It clears injected credentials on exit.

`READY_FOR_PRODUCTION_CANDIDATE=NO`: the configured runner suite passed, but this task does not approve the remaining full-product/security/commercial release gates.
