# Design QA — demonstração do Analytics

- Source visual truth: Browser annotation 3 supplied by the user in this task (655 × 598 px).
- Implementation: `http://localhost:4173/`, flow Entrar → Explorar demonstração.
- Implementation capture: Codex in-app Browser capture, 655 × 598 px viewport, device scale reported by the browser surface as default.
- State: dark theme, unauthenticated demonstration dashboard.
- Density normalization: source and implementation were inspected at the same browser viewport; no resizing was applied.

## Full-view comparison evidence

The demonstration now reproduces the requested commercial-revenue card hierarchy: title and supporting copy above a six-month orange revenue chart, with responsive labels and a contained card. The implementation intentionally uses the demonstration's dark theme while preserving the ORKTO orange accent from the referenced authenticated dashboard.

## Focused region comparison evidence

The chart region was checked directly in the in-app Browser. It renders month labels from Abr to Set, currency ticks, an orange trend line/area, the “Prévia Pro” plan marker, and the disclosure that values are illustrative. No clipping or horizontal overflow was visible at the tested viewport.

## Required fidelity surfaces

- Typography: existing ORKTO font stack, hierarchy and weights preserved.
- Spacing/layout: card aligns with the existing demonstration grid and keeps mobile-friendly padding.
- Colors/tokens: zinc surfaces and ORKTO orange/amber accents preserved.
- Image/assets: no raster assets were required; icons come from the project's existing icon library and the chart from its existing chart library.
- Copy/content: clearly identifies fictitious data and paid-plan availability.

## Interaction checks

- Entrar → Explorar demonstração opens the demo dashboard.
- Analytics preview renders without an error overlay.
- Proposal demo remains available below the new chart.

## Comparison history

- Initial P1: the demonstration did not expose the Analytics experience shown in the source annotation.
- Fix: added a responsive fictitious revenue chart and paid-plan disclosure to `DemoExperience`.
- Post-fix evidence: the in-app Browser rendered the complete chart card with labels, line, plan badge and disclosure.

## Findings

No actionable P0, P1 or P2 visual issues remain for this scoped annotation.

final result: passed
