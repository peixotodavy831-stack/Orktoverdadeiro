# Front B V2 visual review harness

This is a test-only page that mounts the production shell, Hoje, Inbox, Negócios and WIA components. API responses in `fixtures.ts` are intercepted only by `harness.tsx`; they are visibly labeled as test fixtures and are not imported by the application entry.

Build the isolated visual-review page with `node_modules/.bin/vite build --config tests/visual/vite.config.ts --configLoader runner`; it writes only to a task-scoped temporary directory. Serve that directory at `http://127.0.0.1:4173/` for capture. The application production build does not include this harness.

- `?screen=today&theme=dark`
- `?screen=inbox&theme=dark` (desktop opens the thread; mobile opens the conversation list)
- `?screen=inbox&thread=1&theme=light` (mobile conversation)
- `?screen=deals&theme=dark`
- `?screen=wia&theme=light`

Set `theme=light` or `theme=dark`. Review at 390, 768, 1280 and 1440 CSS pixels. Saved captures belong in `tests/visual/artifacts/` and must include viewport and theme in the filename. These fixtures are for visual inspection only and must never be used as production fallback data.

## Automated capture on the Windows review machine

The capture script uses the bundled Playwright package and installed Chrome; it does not install browser software or modify system configuration.

```powershell
$env:NODE_PATH='C:\Users\sobooa7iqytvqheo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
$node='C:\Users\sobooa7iqytvqheo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node tests/visual/capture.mjs
```

The script writes 38 screenshots and `matrix-report.json`. The report also records loading/empty/error/permission/configuration/backend-pending states, keyboard/focus interactions, touch target and accessible-name checks, horizontal overflow, and browser errors. For a quicker interaction/state-only pass while iterating, set `$env:ORKTO_VISUAL_SKIP_MATRIX='1'`; unset it to regenerate the complete screenshot matrix. The test harness intercepts API calls only in this test page, never in the application.
