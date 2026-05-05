# Prymal API Reference

Base URL: `https://api.prymal.io`

All requests require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <your-api-key>
```

---

## Resources

- [Agents](agents.md) — run agents, stream outputs
- [Workflows](workflows.md) — trigger and monitor workflow runs
- [Actions](actions.md) — execute integrations (email, drive, Slack)
- [Webhooks](webhooks.md) — receive real-time event notifications

## SDK

Install the official TypeScript SDK:

```bash
npm install @prymal/sdk
```

```typescript
import { PrymalClient } from '@prymal/sdk';

const prymal = new PrymalClient({ apiKey: process.env.PRYMAL_API_KEY! });

const result = await prymal.agents.run({
  agentId: 'cipher',
  prompt: 'Summarise our Q1 performance.',
});

console.log(result.output);
```

## Rate limits

| Plan    | Requests / minute |
|---------|-------------------|
| Solo    | 30                |
| Pro     | 120               |
| Teams   | 300               |
| Agency  | 600               |

Rate limit headers are included in every response:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 1746489600
```

## Errors

All errors return a JSON body with an `error` field and optional `code`:

```json
{
  "error": "Agent not found.",
  "code": "AGENT_NOT_FOUND",
  "status": 404
}
```

Common error codes:

| Code | Meaning |
|------|---------|
| `AUTH_MISSING` | No Authorization header |
| `AUTH_INVALID` | Key does not match any org |
| `PLAN_GATE` | Feature not available on your plan |
| `WARDEN_BLOCK` | Input flagged by safety firewall |
| `SENTINEL_HOLD` | Output held — requires human review |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
