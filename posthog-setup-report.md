<wizard-report>
# PostHog post-wizard report

The wizard has completed a full client-side PostHog integration for Quartier. PostHog is now initialized via `instrumentation-client.ts` (the recommended approach for Next.js 15.3+), with a reverse proxy configured in `next.config.ts` to route events through `/ingest` and reduce tracking-blocker interference. Eight distinct user actions are now captured across six components.

| Event | Description | File |
|---|---|---|
| `arrondissement_selected` | User clicks an arrondissement on the map, opening the detail panel | `components/map/paris-map.tsx` |
| `arrondissement_panel_closed` | User closes the arrondissement detail panel (X button or Escape key) | `components/map/paris-map.tsx` |
| `persona_changed` | User changes the active persona filter (youngPro, family, tourist, business) | `components/scoring/persona-selector.tsx` |
| `dimension_changed` | User changes the active dimension filter (composite, housing, safety, etc.) | `components/scoring/dimension-select.tsx` |
| `leaderboard_sorted` | User sorts the leaderboard table by a column | `components/leaderboard/leaderboard-table.tsx` |
| `arrondissement_link_clicked` | User clicks an arrondissement link in the leaderboard to go to the detail page | `components/leaderboard/leaderboard-table.tsx` |
| `share_link_copied` | User copies a share link for an arrondissement | `components/share-button.tsx` |
| `locale_switched` | User switches the interface language (FR/EN) | `components/layout/locale-switcher.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- Dashboard: [Analytics basics](https://eu.posthog.com/project/133433/dashboard/545634)
- [Arrondissement selections over time](https://eu.posthog.com/project/133433/insights/ReaRcnL3) - Daily trend of map interactions
- [Most popular arrondissements](https://eu.posthog.com/project/133433/insights/lCHJhjMs) - Which arrondissements users explore most
- [Persona popularity](https://eu.posthog.com/project/133433/insights/SvZR6dxT) - Which user personas are most used (youngPro, family, tourist, business)
- [Share link copies](https://eu.posthog.com/project/133433/insights/K9yqZLFn) - Sharing as a high-intent engagement signal
- [Exploration to share funnel](https://eu.posthog.com/project/133433/insights/1pvQhzsW) - Conversion from arrondissement selection to sharing

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
