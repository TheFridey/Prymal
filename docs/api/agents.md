# Agents API

## List agents

```
GET /api/agents
```

Returns all agents available to your organisation.

**Response**

```json
[
  {
    "id": "cipher",
    "name": "Cipher",
    "description": "Research and analysis agent.",
    "policyClass": "premium_reasoning",
    "capabilities": ["web_search", "document_analysis"],
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

---

## Get agent

```
GET /api/agents/:agentId
```

---

## Run agent

```
POST /api/agents/:agentId/run
```

**Body**

```json
{
  "prompt": "Summarise our Q1 results.",
  "context": {
    "orgName": "Acme Ltd"
  },
  "stream": false
}
```

**Response**

```json
{
  "runId": "run_abc123",
  "agentId": "cipher",
  "verdict": "PASS",
  "output": "Q1 revenue increased by 14%...",
  "sources": [
    { "title": "Q1 Report", "url": "https://...", "score": 0.91 }
  ],
  "sentinelRepairAttempts": 0,
  "audioResponse": null
}
```

Verdict values:

| Verdict | Meaning |
|---------|---------|
| `PASS` | Output passed all SENTINEL safety checks |
| `REPAIR` | Output was automatically repaired and then passed |
| `HOLD` | Output held — requires human review before use |

When `stream: true`, the response is an SSE stream. Events:

```
event: token
data: {"token":"Q1 revenue"}

event: audio_response
data: {"audioBase64":"...","format":"mp3","durationMs":null}

event: done
data: {"verdict":"PASS","runId":"run_abc123"}
```

`audio_response` events are only emitted when TTS is enabled for your plan and organisation.

---

## SDK

```typescript
const result = await prymal.agents.run({
  agentId: 'cipher',
  prompt: 'Summarise Q1.',
});
```
