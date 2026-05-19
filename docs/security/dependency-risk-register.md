# Dependency Risk Register

## 2026-05-19

### Residual low-severity Trigger.dev audit chain

| Advisory ID | Affected package(s) | Current version(s) | Exploitability in Prymal | Mitigation already present | Upgrade plan | Blocks public beta |
| --- | --- | --- | --- | --- | --- | --- |
| `GHSA-pxg6-pf52-xh8x` | `cookie` via `engine.io` -> `socket.io` -> `@trigger.dev/core` -> `@trigger.dev/sdk` | `@trigger.dev/sdk@4.4.0`, `@trigger.dev/core@4.4.0`, `socket.io@4.7.4`, `engine.io@6.5.5`, `cookie` transitively resolved by Trigger.dev | Low. Prymal does not expose Trigger.dev socket endpoints directly, and Trigger.dev scheduling remains an optional server-to-server integration path rather than a public browser entrypoint. | Trigger.dev is optional, disabled unless a server secret is configured, and workflow dispatch now uses a minimal authenticated server-to-server event POST rather than the removed SDK client. Public Clerk, Stripe, billing, and app routes are unaffected. | Re-check Trigger.dev 4.x audit status on each release. Upgrade when Trigger.dev publishes a non-regressive 4.x build that clears the `socket.io` / `engine.io` / `cookie` chain without requiring a downgrade to `@trigger.dev/sdk@3.3.17`. | No |

### Decision note

No backend or frontend production dependency currently reports a `high` or `critical` `npm audit --omit=dev` finding after the 2026-05-19 remediation pass.
