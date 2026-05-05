# Webhooks

Prymal sends signed HTTP POST requests to your endpoint when platform events occur.

Configure your webhook URL and secret in the Prymal dashboard under **Settings → Webhooks**.

---

## Signature verification

Every webhook request includes an `X-Prymal-Signature` header:

```
X-Prymal-Signature: sha256=<hex>
```

The signature is HMAC-SHA256 of the raw request body, keyed with your webhook secret.

**Verify with the SDK (recommended)**

```typescript
import { PrymalWebhook } from '@prymal/sdk';

const webhook = new PrymalWebhook({ secret: process.env.PRYMAL_WEBHOOK_SECRET! });

// Express example
app.post('/webhooks/prymal', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    await webhook.dispatch(req.body, req.headers['x-prymal-signature'] as string);
    res.status(200).end();
  } catch {
    res.status(400).end();
  }
});

webhook.on('agent.run.held', (event) => {
  console.log('Output held for review:', event.data);
});
```

**Verify manually**

```javascript
import { createHmac } from 'node:crypto';

function verifySignature(rawBody, signature, secret) {
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

---

## Event types

| Type | When it fires |
|------|---------------|
| `agent.run.completed` | Agent run finished with PASS or REPAIR verdict |
| `agent.run.held` | Agent run produced a HOLD verdict |
| `workflow.run.completed` | All workflow nodes completed successfully |
| `workflow.run.held` | One or more workflow nodes produced a HOLD verdict |
| `action.executed` | An action (email, drive, Slack) was executed |

---

## Event shape

```json
{
  "id": "evt_abc123",
  "type": "agent.run.held",
  "orgId": "org_xyz",
  "createdAt": "2025-01-01T09:00:00Z",
  "data": {
    "runId": "run_abc",
    "agentId": "cipher",
    "verdict": "HOLD",
    "holdReason": "sentinel_hold_after_repair"
  }
}
```

---

## Retries

Failed deliveries (non-2xx or timeout) are retried up to 5 times with exponential backoff (starting at 30 seconds). Respond with `2xx` as quickly as possible — process events asynchronously if needed.
