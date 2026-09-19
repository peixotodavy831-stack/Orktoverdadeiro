# ORKTO Minimal Redesign — Design QA

- Source visual truth: `C:/Users/sobooa7iqytvqheo/Documents/Codex/.codex-remote-attachments/01a0b54e-4efe-7cc0-8bee-d5d9baff8b36/75d7aec1-f9b2-41ea-9f10-1ace3c3d1403/1-Photo-1.jpg`
- Implementation: `http://127.0.0.1:4174/`
- Implementation screenshot: Codex in-app browser capture, tab 8, desktop and mobile states
- Viewports: 1440 × 900 desktop and 390 × 844 mobile
- Source pixels: 1280 × 960
- Implementation CSS sizes: 1440 × 900 and 390 × 844 at device scale factor 1
- State: unauthenticated landing page, dark theme

## Full-view comparison evidence

The implementation follows the source's black, graphite, off-white and orange system; Inter typography; two-column desktop hero; compact operational dashboard preview; thin borders; and restrained elevation. The mobile layout preserves the same hierarchy in a single column. The implementation intentionally omits the source brand-board labels and phone mockup because the requested artifact is the actual site, not a presentation board.

## Focused region comparison evidence

- Hero: large white statement with orange outcome word, left aligned and vertically centered against the dashboard preview.
- Product preview: four compact metrics, recent conversations and next actions retain the source's dense command-center language.
- Navigation and CTAs: reduced to one quiet secondary action and one orange primary action.
- Mobile: headline, CTAs and dashboard preview fit at 390 px without horizontal overflow.

## Required fidelity surfaces

- Fonts and typography: Inter is used throughout with 400–700 weights; heading tracking and line-height match the compact reference hierarchy.
- Spacing and layout rhythm: broad section spacing, thin separators, low radii and compact internal card spacing are consistent.
- Colors and visual tokens: `#0B0B0D`, graphite surfaces, off-white text and `#FF8A00` are used consistently; decorative gradients were removed.
- Image quality and assets: the reference contains no required photographic hero asset. UI icons use the project's installed icon library. The supplied ORKTO wordmark remains crisp and code-native from the existing product component.
- Copy and content: the page now leads with “Conversas viram resultados” and explains operational outcomes rather than presenting a long feature inventory.

## Primary interactions tested

- “Ver a experiência” opens the existing proposal demonstration.
- “Organizar minha operação” opens authentication.
- Responsive layout verified at desktop and mobile breakpoints.
- Browser console checked: no redesign errors; one existing Three.js deprecation warning remains outside this page.

## Findings

No actionable P0, P1 or P2 visual issues remain.

## Comparison history

- Initial implementation: validated hero hierarchy, dashboard density and mobile stacking against the reference.
- Fixes made: removed the previous decorative grid, gradients, animated demo, magnetic CTAs and repeated marketing sections; standardized Inter and the orange token; simplified product copy and page length.
- Post-fix evidence: desktop and 390 px mobile browser captures show the intended minimal hierarchy with working primary actions.

## Follow-up polish

- P3: the authenticated dashboard still contains some legacy dense cards below the redesigned header and can receive the same reduction in a dedicated second pass.

final result: passed
