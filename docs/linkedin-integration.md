# LinkedIn Integration

Prymal uses LinkedIn OAuth 2.0 for LinkedIn publishing. Do not paste browser cookies, organisation IDs, author URNs, or manual API tokens into Prymal.

## LinkedIn App Setup

Create or update the LinkedIn developer app in the LinkedIn Developer Portal.

Start with identity-only connection:

- Sign in with LinkedIn using OpenID Connect: `openid`, `profile`, `email`

Add posting permissions only after LinkedIn approves the matching app product:

- Share on LinkedIn: `w_member_social`
- Company/page publishing: `w_organization_social`

LinkedIn's current Posts API uses `POST https://api.linkedin.com/rest/posts` with:

- `Authorization: Bearer <access token>`
- `X-Restli-Protocol-Version: 2.0.0`
- `Linkedin-Version: YYYYMM`
- `Content-Type: application/json`

LinkedIn documents the Posts API as the replacement for `ugcPosts`; the author can be a person URN or organisation URN when the authenticated member has the required permission.

Official references:

- LinkedIn OAuth access tokens: https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
- LinkedIn Posts API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- LinkedIn OpenID Connect: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin
- LinkedIn organization access controls: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role

## Redirect URI

Register this redirect URI in LinkedIn:

```text
${API_URL}/api/integrations/linkedin/callback
```

For production Prymal, that is usually:

```text
https://api.prymal.io/api/integrations/linkedin/callback
```

## Environment Variables

```bash
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_SCOPES="openid profile email"
LINKEDIN_API_VERSION=202603
```

`LINKEDIN_SCOPES` is intentionally identity-only by default. Once LinkedIn approves posting access for the app, update it to include the approved posting scopes, for example:

```bash
LINKEDIN_SCOPES="openid profile email w_member_social"
```

For company/page posting, include the approved organisation posting scope as well:

```bash
LINKEDIN_SCOPES="openid profile email w_member_social w_organization_social"
```

`LINKEDIN_API_VERSION` is optional. If omitted, Prymal uses the backend-pinned version.

## Connecting

1. Open Prymal Integrations.
2. Choose LinkedIn.
3. Click Connect LinkedIn.
4. Approve the requested LinkedIn permissions.
5. Choose where Prymal should publish:
   - personal profile: `urn:li:person:<id>`
   - company page: `urn:li:organization:<id>`

When LinkedIn returns organisation access controls, Prymal shows an author selector. If LinkedIn does not return page access, Prymal keeps a manual Author URN field with helper copy. The connected member must have permission to publish as the selected author.

## Troubleshooting

- Missing posting permission: reconnect LinkedIn after enabling the required product/scope in the LinkedIn developer app.
- `unauthorized_scope_error`: LinkedIn rejected a scope that is not approved for the app. Start with `LINKEDIN_SCOPES="openid profile email"`, restart the backend, and reconnect. After LinkedIn approves posting, add only the approved posting scopes and reconnect again.
- Invalid author: use `urn:li:person:<id>` or `urn:li:organization:<id>`.
- Expired or invalid token: reconnect LinkedIn.
- Organisation posting denied: confirm the connected LinkedIn member has an approved company page role such as administrator, direct sponsored content poster, or content admin.

## Current Limits

- Text posts and link posts are supported.
- Image publishing is intentionally disabled until LinkedIn media upload is implemented safely.
- Old manual-token LinkedIn rows are marked degraded and require reconnect.
