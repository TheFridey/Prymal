# Integrations Auth Audit

This audit records the expected auth route, publish/test support, risk, and copy direction for the integration catalog.

| Service | Current auth mode | Recommended auth mode | Status | Publish | Test | Required permissions | Risk | Copy recommendation | Follow-up |
|---|---|---|---|---|---|---|---|---|---|
| Gmail | OAuth | OAuth | Good | No | Google userinfo | `https://mail.google.com/`, `gmail.send` | Medium | "Connect Gmail with Google OAuth." | Keep refresh-token handling monitored. |
| Outlook | OAuth | OAuth | Upgraded | Yes | Graph `/me` | `openid profile email offline_access User.Read Mail.Send` | Medium | "Connect Microsoft 365 with OAuth." | Add inbox read only when implemented. |
| Resend | Manual token | Manual token | Good | Yes | Provider API | Resend API key and verified sender | Medium | "Resend API key." | None. |
| Postmark | Manual token | Manual token | Good | Yes | Provider API | Server API token | Medium | "Postmark Server API token." | None. |
| SendGrid | Manual token | Manual token | Good | Yes | Provider API | API key with `mail.send` | Medium | "SendGrid API key." | None. |
| Mailgun | Manual token | Manual token | Good | Yes | Provider API | Private API key and sending domain | Medium | "Mailgun private API key." | None. |
| Brevo | Manual token | Manual token | Good | Yes | Provider API | Brevo API key | Medium | "Brevo API key." | None. |
| SparkPost | Manual token | Manual token | Good | Yes | Provider API | SparkPost API key | Medium | "SparkPost API key." | None. |
| Elastic Email | Manual token | Manual token | Good | Yes | Provider API | Elastic Email API key | Medium | "Elastic Email API key." | None. |
| Mailjet | Manual token | Manual token | Good | Yes | Provider API | API key + secret key | Medium | "Mailjet secret key and public API key." | None. |
| Google Drive | OAuth | OAuth | Good | No | Google userinfo | `drive.readonly` | Low | "Connect Google Drive with OAuth." | None. |
| OneDrive | OAuth | OAuth | Upgraded | No | Graph `/me` and `/me/drive` | `openid profile email offline_access User.Read Files.Read.All` | Low | "Connect OneDrive with Microsoft OAuth." | Move to narrower Files scope if Graph app permits. |
| SharePoint | Manual token | OAuth preferred | Beta/manual | No | Graph/SharePoint runtime | Graph token with sites/files access | High | "Microsoft Graph token for SharePoint/Files." | Convert to Microsoft OAuth with site picker. |
| Dropbox | Manual token | OAuth preferred | Beta/manual | No | Dropbox account lookup | User access token | Medium | "Dropbox user access token." | Add OAuth app credentials later. |
| Box | Manual token | OAuth preferred | Beta/manual | No | Box users/me | User access token | Medium | "Box user access token." | Add OAuth app credentials later. |
| Nextcloud | Manual token | Manual token | Good | No | WebDAV | App password | Low | "Nextcloud app password." | None. |
| WebDAV | Manual token | Manual token | Good | No | WebDAV | Password/token | Medium | "WebDAV password or token." | Keep HTTPS validation. |
| Notion | OAuth | OAuth | Good | No | Notion users/me | Notion OAuth grant | Low | "Connect Notion with OAuth." | None. |
| Confluence | Manual token | Manual token | Good | No | Runtime wiki probe | Atlassian email + API token | Medium | "Atlassian API token." | OAuth long-term optional. |
| Outline | Manual token | Manual token | Good | No | Runtime wiki probe | Outline API token | Low | "Outline API token." | None. |
| Coda | Manual token | Manual token | Good | No | Runtime wiki probe | Coda API token | Low | "Coda API token." | None. |
| BookStack | Manual token | Manual token | Good | No | Runtime wiki probe | Token ID/secret style token | Medium | "BookStack API token." | Clarify token ID/secret format if needed. |
| Slack | OAuth | OAuth | Good | Yes | Slack `auth.test` | Bot scopes for chat posting | Medium | "Connect Slack with OAuth." | None. |
| Discord | Manual token | Bot token | Good | Yes | Discord bot `/users/@me` | Bot token and channel ID | Medium | "Discord bot token." | None. |
| Telegram | Manual token | Bot token | Good | Yes | Telegram `getMe` | Bot token and chat/channel ID | Medium | "Telegram bot token." | None. |
| LINE | Manual token | Channel token | Good | Yes | Runtime channel profile | Channel access token | Medium | "LINE channel access token." | None. |
| Teams incoming | Webhook bridge | Webhook bridge | Good | Yes | Saved/no auto-probe | Incoming webhook URL | Low | "Teams incoming webhook URL." | Keep no-probe safety. |
| Mattermost incoming | Webhook bridge | Webhook bridge | Good | Yes | Saved/no auto-probe | Incoming webhook URL | Low | "Mattermost incoming webhook URL." | Keep no-probe safety. |
| Rocket.Chat incoming | Webhook bridge | Webhook bridge | Good | Yes | Saved/no auto-probe | Incoming webhook URL | Low | "Rocket.Chat incoming webhook URL." | Keep no-probe safety. |
| Webex incoming | Webhook bridge | Webhook bridge | Good | Yes | Saved/no auto-probe | Incoming webhook URL | Low | "Webex incoming webhook URL." | Keep no-probe safety. |
| X | Manual token | OAuth preferred | Beta/manual | Yes | X `/2/users/me` | User access token with read/write scopes | High | "X OAuth 2.0 user access token." | Add full OAuth 2.0 PKCE/app flow. |
| Mastodon | Manual token | Manual token acceptable | Good | Yes | Verify credentials | User access token with `write:statuses` | Medium | "Mastodon user access token." | None. |
| LinkedIn | OAuth | OAuth | Upgraded | Yes, when posting scopes are approved | OIDC userinfo + optional organisation ACLs | Default `openid profile email`; add `w_member_social` / `w_organization_social` only after LinkedIn approval | High | "Connect LinkedIn. Posting requires approved LinkedIn posting permissions." | Add media upload before enabling images; keep scope config aligned with approved app products. |
| Bluesky | Manual app password | App password | Good | Yes | AT Protocol login | Handle/DID + app password | Medium | "Bluesky app password." | None. |
| GitHub social | Manual PAT | PAT acceptable | Good | Yes | GitHub API | PAT with gist permission | Medium | "GitHub personal access token." | None. |
| Zapier / Make / n8n / Pipedream / IFTTT / Workato / Tray.io / Relay.app / Parabola / Integrately / Pabbly / Albato / Automate.io / Custom webhook | Webhook bridge | Webhook bridge | Correct | Yes | Saved/no auto-probe | HTTPS webhook URL, optional bearer/shared secret | Low | "Webhook URL and optional shared secret." | Keep no automatic POST during connect. |

## Security Notes

- OAuth and manual secrets are encrypted at rest.
- Secrets are not serialized to the frontend.
- Webhook integrations are saved without probing by default to avoid unintended third-party side effects.
- Old LinkedIn manual-token rows are not deleted, but are degraded and cannot publish until reconnected through OAuth.
- Agent chat publishing uses `social.publish` and the action approval flow. Connected platforms are not called until the user approves the proposed post.
