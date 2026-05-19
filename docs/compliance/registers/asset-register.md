# Asset Register

| Asset ID | Asset | Owner | Type | Location | Classification | Criticality | Backup required | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AST-001 | Prymal backend API | Engineering | application | production VPS | Confidential | High | N/A | Hono + Node backend |
| AST-002 | Prymal frontend | Engineering | application | static host | Internal | High | N/A | production web app |
| AST-003 | PostgreSQL production database | Engineering | data store | VPS/private network | Restricted | High | Yes | customer and workflow data |
| AST-004 | GitHub repository | Engineering | source / CI | GitHub | Confidential | High | Yes | source code and workflow config |
| AST-005 | Clerk tenant | Engineering | supplier SaaS | Clerk | Restricted | High | No | auth and session management |
| AST-006 | Stripe account | Finance / Engineering | supplier SaaS | Stripe | Restricted | High | No | billing operations |
| AST-007 | Cloudinary account | Engineering | supplier SaaS | Cloudinary | Confidential | Medium | No | production media storage |
| AST-008 | Cloudflare zone | Engineering | supplier SaaS | Cloudflare | Confidential | High | No | DNS, TLS, proxy |
| AST-009 | Resend account | Engineering | supplier SaaS | Resend | Confidential | Medium | No | transactional email |
| AST-010 | Placeholder row | Owner | type | location | classification | criticality | Yes/No | add more assets here |
