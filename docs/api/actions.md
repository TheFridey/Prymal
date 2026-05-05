# Actions API

Actions execute integrations on behalf of your organisation. Requires **Pro**, **Teams**, or **Agency** plan.

OAuth credentials for Google (Gmail/Drive) and Slack must be connected via the Prymal dashboard before calling these endpoints.

---

## List supported action types

```
GET /api/actions/types
```

**Response**

```json
["email.send","drive.write","drive.append","drive.folder","slack.post","slack.reply"]
```

---

## Execute action

```
POST /api/actions/execute
```

**Body — email.send**

```json
{
  "type": "email.send",
  "to": "recipient@example.com",
  "subject": "Monthly Report",
  "body": "Please find the report attached.",
  "replyTo": "noreply@yourorg.com",
  "cc": "manager@yourorg.com"
}
```

**Body — drive.write**

```json
{
  "type": "drive.write",
  "name": "Q1 Report",
  "content": "Report content here...",
  "mimeType": "text/plain",
  "folderId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
}
```

**Body — slack.post**

```json
{
  "type": "slack.post",
  "channel": "#general",
  "text": "Report is ready.",
  "blocks": []
}
```

**Response**

```json
{
  "success": true,
  "type": "email.send",
  "result": {
    "messageId": "msg_abc123"
  }
}
```

---

## SDK

```typescript
await prymal.actions.execute({
  type: 'slack.post',
  channel: '#reports',
  text: 'Q1 Report is ready for review.',
});
```
