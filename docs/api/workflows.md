# Workflows API

## List workflows

```
GET /api/workflows
```

---

## Get workflow

```
GET /api/workflows/:workflowId
```

**Response**

```json
{
  "id": "wf_abc123",
  "orgId": "org_xyz",
  "name": "Monthly Report",
  "description": "Generates the monthly performance report.",
  "nodes": [
    { "id": "node_1", "agentId": "cipher", "label": "Research" },
    { "id": "node_2", "agentId": "herald", "label": "Write" }
  ],
  "contractEnforced": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-06-01T00:00:00Z"
}
```

`contractEnforced: true` means all node outputs are validated against their declared `outputSchema` before proceeding to the next node. Nodes that fail schema validation produce a `HOLD` verdict.

---

## Run workflow

```
POST /api/workflows/:workflowId/run
```

**Body**

```json
{
  "input": {
    "month": "January",
    "year": 2025
  }
}
```

**Response**

```json
{
  "id": "run_xyz789",
  "workflowId": "wf_abc123",
  "status": "completed",
  "nodeResults": [
    {
      "nodeId": "node_1",
      "agentId": "cipher",
      "verdict": "PASS",
      "output": "Research complete...",
      "sentinelRepairAttempts": 0
    }
  ],
  "startedAt": "2025-01-01T09:00:00Z",
  "completedAt": "2025-01-01T09:02:14Z"
}
```

**Status values**

| Status | Meaning |
|--------|---------|
| `pending` | Workflow queued |
| `running` | Currently executing nodes |
| `completed` | All nodes passed |
| `held` | One or more nodes produced a HOLD verdict |
| `failed` | Execution error |

---

## Get workflow run

```
GET /api/workflows/:workflowId/runs/:runId
```

---

## SDK

```typescript
const run = await prymal.workflows.run('wf_abc123', { month: 'January', year: 2025 });

if (run.status === 'held') {
  // Handle held outputs — do not display to end users without review
}
```
