# Analytics events

Prymal uses a unified frontend analytics helper (`frontend/src/lib/analytics.js`) for product and marketing funnel instrumentation. Events are sent to Plausible via `window.prymalTrack` when available, and selected authenticated funnel events are also persisted to `/api/org/product-events`.

## Transport

| Layer | Mechanism | When |
| --- | --- | --- |
| Public marketing | `window.prymalTrack` → Plausible (`main.jsx`) | Always attempted; no-op if absent |
| Authenticated product funnel | Same + `trackProductEvent` POST | For onboarding, first win, agent first run, workflow template, upgrade, and checkout events |

Local development does not load Plausible by default. Calls are safe no-ops when the tracker is missing or throws.

## Event catalogue

### `public_page_view`

Fired once per public marketing route change.

| Property | Type | Notes |
| --- | --- | --- |
| `page` | string | Normalised page key (`landing`, `pricing`, `blog_post`, …) |
| `route` | string | Pathname only (no query values with PII) |

### `cta_clicked`

Fired from `PublicCta` components and marketing CTAs.

| Property | Type | Notes |
| --- | --- | --- |
| `cta` | string | Stable CTA id (`signup`, `view-pricing`, `upgrade-pro`, …) |
| `surface` | string | UI placement (`landing-hero`, `pricing-card-pro`, `blog-inline-cta`, …) |
| `intent` | string | Funnel intent (`convert`, `learn`, `upgrade`) |

When `intent` is `upgrade`, `upgrade_intent` is also recorded.

### `pricing_plan_viewed`

Fired when a pricing plan card is at least 50% visible in the viewport (once per plan per billing interval tab).

| Property | Type | Notes |
| --- | --- | --- |
| `plan_id` | string | Plan slug (`solo`, `pro`, `agency`) |
| `interval` | string | Billing interval id (`monthly`, `annual`, …) |

### `signup_started`

Fired when the Clerk sign-up screen mounts at `/signup`.

| Property | Type | Notes |
| --- | --- | --- |
| `surface` | string | Defaults to `signup_page` |
| `offer` | string | Optional offer key from query string (`founding-access`) |

### `onboarding_started`

Fired when workspace onboarding mounts at `/app/onboarding`.

| Property | Type | Notes |
| --- | --- | --- |
| `surface` | string | Defaults to `onboarding` |
| `step` | number | Initial step index |

### `first_win_selected`

Fired when a user picks or confirms their first-win outcome during onboarding or from the dashboard first-run panel.

| Property | Type | Notes |
| --- | --- | --- |
| `outcome_id` | string | First-win outcome id |
| `surface` | string | `onboarding_picker`, `onboarding_complete`, or `dashboard_first_run` |
| `recommended_agent_id` | string | Optional agent id |
| `credit_intensity` | string | Optional estimate band |

### `first_agent_run_started`

Fired on the first chat message in a new agent conversation (no existing conversation id).

| Property | Type | Notes |
| --- | --- | --- |
| `agent_id` | string | Agent id |
| `outcome_id` | string | Optional linked first-win outcome |
| `surface` | string | Defaults to `agent_chat` |

### `first_agent_run_completed`

Fired when the first agent chat response finishes streaming successfully.

| Property | Type | Notes |
| --- | --- | --- |
| `agent_id` | string | Agent id |
| `conversation_id` | string | Conversation uuid |
| `message_id` | string | Assistant message id when available |
| `outcome_id` | string | Optional linked first-win outcome |

### `workflow_template_opened`

Fired when a workflow template is opened in the builder or template library.

| Property | Type | Notes |
| --- | --- | --- |
| `template_slug` | string | Template slug |
| `surface` | string | `workflows`, `workflow_builder`, or `dashboard` |
| `action` | string | e.g. `open_builder`, `load_template` |

### `upgrade_intent`

Fired when a user clicks an upgrade-oriented CTA or billing upgrade control (before checkout).

| Property | Type | Notes |
| --- | --- | --- |
| `surface` | string | UI placement |
| `plan_id` | string | Target plan when known |
| `intent` | string | Usually `upgrade` |
| `cta` | string | Optional CTA id |

### `dashboard_quick_action_clicked`

Fired when a user selects a dashboard quick action card.

| Property | Type | Notes |
| --- | --- | --- |
| `action_id` | string | Stable action id (`ask_agent`, `run_workflow`, …) |
| `surface` | string | Defaults to `dashboard` |
| `route` | string | Target path (no query values with PII) |

### `dashboard_time_saved_viewed`

Fired once when the time-saved module mounts on the dashboard.

| Property | Type | Notes |
| --- | --- | --- |
| `surface` | string | Defaults to `dashboard` |
| `is_empty` | boolean | Whether the user has no estimated activity yet |
| `minutes_month` | number | Estimated minutes saved this month |
| `workflows_run` | number | Workflow run count used in the estimate |

### `dashboard_continue_clicked`

Fired when a user continues a recent conversation, workflow, or template from the dashboard.

| Property | Type | Notes |
| --- | --- | --- |
| `surface` | string | Defaults to `dashboard` |
| `item_type` | string | `conversation`, `workflow`, or `template` |
| `route` | string | Continue destination path |

### `dashboard_recommended_next_step_clicked`

Fired when a user follows the single recommended next-step card.

| Property | Type | Notes |
| --- | --- | --- |
| `surface` | string | Defaults to `dashboard` |
| `recommendation_id` | string | Rule id (`first_win`, `add_lore`, `upgrade_pro`, …) |
| `route` | string | Destination path |
| `plan_id` | string | Optional plan slug when recommendation is upgrade-oriented |

### `checkout_started`

Fired immediately before a Stripe checkout request is sent.

| Property | Type | Notes |
| --- | --- | --- |
| `checkout_type` | string | `plan` or `credit_pack` |
| `plan_id` | string | For plan checkout |
| `interval` | string | Billing interval when applicable |
| `pack_id` | string | For credit pack checkout |
| `credit_type` | string | `execution` or `video` for packs |
| `surface` | string | Defaults to `settings_billing` |

## Privacy rules

The analytics helper sanitises every payload before send:

- **Never included:** prompt text, message bodies, document content, attachment names/content, emails, passwords, tokens, secrets, custom instructions, or arbitrary nested objects.
- **Allowed:** stable ids, surface names, plan/outcome/template slugs, counts, booleans, and short enum-like strings (truncated to 120 characters).
- **Blocked key patterns:** keys matching `prompt`, `message`, `content`, `text`, `document`, `body`, `email`, `password`, `token`, `secret`, `attachment`, `instruction`, `snippet`, or `transcript` (case-insensitive).

If you add a new property, confirm it cannot carry user-generated or tenant-private content.

## Implementation map

| Event | Primary wiring |
| --- | --- |
| `public_page_view` | `AnalyticsPageView` in `App.jsx` |
| `cta_clicked` | `PublicCta` via `public-analytics.js` |
| `pricing_plan_viewed` | `usePricingPlanImpressions` in `PricingPageContent.jsx` |
| `signup_started` | `AuthPage` sign-up mount |
| `onboarding_started` | `Onboarding.jsx` mount |
| `first_win_selected` | `Onboarding.jsx`, `Dashboard.jsx` |
| `first_agent_run_started` / `completed` | `useChatSend.js` |
| `workflow_template_opened` | `Workflows.jsx`, `WorkflowBuilder.jsx`, `Dashboard.jsx` |
| `upgrade_intent` | `public-analytics.js`, `SettingsTabPanels.jsx` |
| `checkout_started` | `Settings.jsx` billing mutations |
| `dashboard_quick_action_clicked` | `DashboardQuickActions.jsx` |
| `dashboard_time_saved_viewed` | `DashboardTimeSaved.jsx` |
| `dashboard_continue_clicked` | `DashboardContinueWork.jsx` |
| `dashboard_recommended_next_step_clicked` | `DashboardRecommendedNext.jsx` |

## Tests

`frontend/src/lib/analytics.test.js` covers payload sanitisation, no-op fallback behaviour, public vs persisted routing, and route helpers. `frontend/src/lib/public-analytics.test.js` covers CTA click wiring.
