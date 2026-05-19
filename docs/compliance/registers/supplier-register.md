# Supplier Register

| Supplier ID | Supplier | Service | Owner | Security relevance | MFA required | Review frequency | Last review | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SUP-001 | GitHub | source control and CI | Engineering | High | Yes | annual | YYYY-MM-DD | partial | branch protection and secret scanning documented |
| SUP-002 | Cloudflare | DNS, TLS, reverse proxy | Engineering | High | Yes | annual | YYYY-MM-DD | partial | Full strict evidence required |
| SUP-003 | Clerk | authentication | Engineering | High | Yes | annual | YYYY-MM-DD | partial | webhook and admin security evidence needed |
| SUP-004 | Stripe | billing | Finance / Engineering | High | Yes | annual | YYYY-MM-DD | partial | webhook health evidence needed |
| SUP-005 | Cloudinary | media storage | Engineering | Medium | Yes | annual | YYYY-MM-DD | partial | production media dependency |
| SUP-006 | Resend | email | Engineering | Medium | Yes | annual | YYYY-MM-DD | partial | domain and account security review needed |
| SUP-007 | OpenAI | model provider | Engineering | Medium | Yes | annual | YYYY-MM-DD | partial | access and usage review needed |
| SUP-008 | Anthropic | model provider | Engineering | Medium | Yes | annual | YYYY-MM-DD | partial | access and usage review needed |
| SUP-009 | VPS provider | hosting | Engineering | High | Yes | annual | YYYY-MM-DD | missing | capture MFA and account review evidence |
| SUP-010 | Domain registrar | domain control | Founder / Engineering | High | Yes | annual | YYYY-MM-DD | missing | capture MFA and account review evidence |
