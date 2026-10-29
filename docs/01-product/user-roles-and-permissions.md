# User roles and permissions

Status: proposed • Owner: security architect • Related: PLT-001/002, COL-001, ADM-001, SEC-001. Scope: every API, event, object grant and worker action. Subscription entitlements never grant a role.

## Scope and evaluation

Organization contains workspaces; workspace is the tenant boundary. Active membership admits a user to that scope; an assigned role grants explicit actions at workspace or project scope. Allow grants combine only within their stated scope. A narrow project grant does not revoke an existing broader owner/admin grant; remove the broad grant explicitly when restricting a user. Revocation, suspended account, expired grant and workspace policy deny before any allow. Validate actor, action, resource, tenant, project, referenced asset version, expiry and entitlement. Deny by default. A project-scoped role sees only that project and authorized referenced assets, not the whole media library.

| Role | Grant and scope | Exclusions |
|---|---|---|
| Anonymous visitor | Public entry; explicit valid share credential on one artifact/revision | Tenant discovery, account APIs, editing, billing |
| Registered creator | self.read/logout; workspace.create/list for own memberships | No content access without scoped role |
| Workspace owner | All workspace project/media/member/share actions, usage.read and ownership transfer | Organization/platform authority; financial account actions require billing role |
| Workspace administrator | Workspace projects/media/members/shares/usage within policy | Ownership transfer, assigning/removing owners, billing credentials |
| Project editor | project.read/edit, asset.read on authorized references, render.create, ai.execute, job.read, export.list/download for assigned project | Workspace library listing, sharing/member changes, finance, destructive project administration |
| Project contributor | project.read and own asset.upload; submit content proposal where feature exists | No project.edit, render, AI, publish, share or membership by default |
| Reviewer/commenter | Assigned immutable review revision/artifact, comment.create if enabled | Original media, editable JSON, render, membership; downloads only explicit grant |
| View-only collaborator | Read assigned review/project surface; export download only explicit grant | Comments and mutations |
| Billing administrator | usage.read and billing.manage at assigned workspace/organization | Media/project content, member changes, render, AI |
| Organization administrator | Organization policy, organization membership, workspace metadata, audit metadata | Content, billing payment instruments, self-promotion to workspace content role |
| Platform administrator | Scoped platform operations and audited emergency controls | Routine customer content; separate time-limited authorized grant needed |
| Support operator | Time-limited authorized diagnostic metadata | Content, finance, membership, credentials |
| Worker identity | Exact leased snapshot inputs and attempt output keys | Interactive sessions, tenant enumeration, unrelated jobs |
| Integration identity | Explicit scopes, resource bound, expiring/revocable credential | Interactive owner privileges or unrelated resources |

## Action matrix

O = owner, A = workspace administrator, E = project editor, C = contributor, R = reviewer, V = viewer, B = billing administrator. Dashes deny. A conditional grant never expands beyond the project/share scope.

| Action | O | A | E | C | R | V | B |
|---|---|---|---|---|---|---|---|
| Project create/archive/delete/restore | yes | yes | — | — | — | — | — |
| Project/revision read | yes | yes | assigned | assigned | review only | granted surface | — |
| Project edit/captions/thumbnail save | yes | yes | assigned | — | — | — | — |
| Asset library list | yes | yes | authorized references only | own uploads only | — | — | — |
| Asset upload | yes | yes | assigned workspace/project | own | — | — | — |
| Asset original/proxy read | yes | yes | referenced authorized media | own + granted references | review derivative only | granted derivative only | — |
| Render/AI submit | yes | yes | assigned + policy/consent | — | — | — | — |
| Job read / cancel | all | all | assigned read / own cancel | own ingest | — | — | — |
| Export list/download | yes | yes | assigned | — | explicit share | explicit grant | — |
| Comments | yes | yes | assigned | assigned if enabled | granted | — | — |
| Members/shares/API credential manage | yes | delegated non-owner only | — | — | — | — | — |
| Ownership transfer | initiate/accept | — | — | — | — | — | — |
| Billing manage | separate B role | separate B role | — | — | — | — | yes |
| Workspace usage/audit metadata | yes | yes | own operation status only | own operation status only | — | — | usage/billing audit only |

Member invitations expire (proposed 7 days), are single-use and bind intended identity, role and scope. Acceptance rechecks inviter authority. Ownership transfer requires current owner and active recipient acceptance, atomically maintaining at least one owner. Admin cannot assign owner. Organization recovery is a separate audited emergency process, not implicit content access.

Share expiry is mandatory; explicit allowDownload defaults false. Store hashes of cryptographically random tokens. Revocation prevents new grants/requests and closes subscriptions; direct object URLs already issued retain TTL, so route immediate-revocation review through an authorization gateway. Payment, successful rendering and knowing an ID confer no access. Jobs recheck policy before dispatch/publication; downloads recheck current access. Audit action/scope/result without tokens or media. Acceptance: each OpenAPI x-permission maps here; test role × scope × action plus revoked/expired/cross-tenant and concurrent-transfer cases (AT-01, AT-14, AT-19, AT-25).
