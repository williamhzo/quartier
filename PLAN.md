# Launch Readiness Plan

Objective: get `quartier` to a clean, credible public-launch state before announcing it. This pass removes misleading product claims, clears framework/lint blockers, and makes the build/docs reproducible enough that contributors can trust the repo.

Defaults chosen:
- Hard cutover nightlife out of v1. Do not keep placeholder UI or copy that implies it is scored today.
- Replace app fonts with local bundled fonts to remove the Google-font build dependency.
- Keep scope focused on launch blockers and repo trustworthiness, not broader redesign or data-methodology changes.

## 1. P0 Product Truth: Ship 9 Real Dimensions

Goal: make every public surface match the data that is actually shipped.

[x] Remove nightlife from all public copy, metadata, and UI where it is currently presented as a scored dimension.
[x] Remove nightlife from ranking/composite weighting for v1 so persona math reflects only shipped dimensions.
[x] Update the user-facing labels and docs so the app consistently describes a 9-dimension product.
[x] Keep the data pipeline internal-only and make that status explicit in repo docs.

Acceptance criteria:
- No public page, metadata string, or README text claims nightlife is currently scored.
- No selector, table column, detail section, or composite weight references nightlife in the shipping app.
- The app consistently describes 9 dimensions everywhere.

## 2. P1 Runtime Correctness: Fix Main App Bugs

Goal: clear current lint/runtime issues and obvious public-facing behavior bugs.

[x] Refactor the map panel selection logic to remove ref reads/writes during render and satisfy the React 19 / Next 16 lint rule.
[x] Preserve locale when copying arrondissement detail links from both the map panel and detail page.
[x] Re-run lint after the refactor and treat a clean lint pass as required for launch.
[x] Smoke-check map interactions after the refactor: hover, click, escape-to-close, and localized share behavior.

Acceptance criteria:
- `bun run lint` passes cleanly.
- Copying a French detail page shares a French URL; English shares an English/default URL.
- Map selection behavior is unchanged except for the bug fix.

## 3. P1 Framework Contract: Normalize Layout + Fonts

Goal: make the app conform to documented Next.js structure and remove fragile build-time font fetching.

[x] Keep `[locale]/layout` as the document root for the locale-scoped app shell so the rendered `<html lang>` stays correct.
[x] Replace `next/font/google` usage with local bundled fonts from `assets/fonts`.
[x] Preserve the existing CSS variable contract so the UI styling stays stable.
[x] Re-run production build after the font/layout change.

Acceptance criteria:
- `bun run build` succeeds without needing Google font downloads.
- Root layout owns the document shell; locale layout only wraps route content.
- Typography and spacing remain materially unchanged on main pages.

## 4. P2 Repo Trust: Fix Docs and Contributor Setup

Goal: make the repository instructions reflect the actual app.

[x] Update the README launch copy, local setup instructions, and feature list to match the shipping 9-dimension product.
[x] Remove stale map-key guidance from README and `.env.example`.
[x] Add a short “current data coverage” note so contributors understand what is live versus future work.
[x] Keep contributor instructions aligned with the actual validation gates we expect before shipping.

Acceptance criteria:
- README and `.env.example` are internally consistent.
- A new contributor can follow setup instructions without guessing.
- Public-facing repo copy no longer overpromises unavailable data.

## 5. P3 Validation + Launch Pass

Goal: finish with a small, explicit release checklist instead of ad hoc confidence.

[x] Run `bun run lint`.
[x] Run `bun run build`.
[x] Manually check the map page, leaderboard page, and localized detail page in the browser.
[x] Verify metadata-critical paths: detail page locale alternates, OG image route, and sitemap generation.
[x] Do a final repo-wide search for stale nightlife/10-dimension/old env-var references on the shipping surface.

Manual smoke scenarios:
- Home page loads in `en` and `fr`.
- Persona switching and dimension switching work with the reduced dimension set.
- Detail page share button copies the correct localized link.
- Leaderboard renders and sorts correctly after nightlife removal.
- OG routes still resolve for generic and arrondissement-specific images.

Definition of done:
- The repo passes lint/build.
- The product promise matches shipped data.
- The launch path has no known correctness or credibility blockers.

## 6. P1 Nightlife Restoration

Goal: restore nightlife as a real shipped dimension using the downloaded SIRENE stock parquet, not the live API.

[x] Step 1. Generate a tracked arrondissement nightlife snapshot from the stock parquet.
[x] Step 2. Rewire refresh/build to consume the snapshot instead of API page cache.
[x] Step 3. Re-enable nightlife in config, scoring, and generated data outputs.
[ ] Step 4. Restore nightlife in the UI and validate it end to end.

Acceptance criteria:
- Snapshot covers all 20 Paris arrondissements.
- Build path does not require `SIRENE_API_TOKEN`.
- `data/arrondissements.json`, `data/metadata.json`, and UI all expose the same nightlife story.
