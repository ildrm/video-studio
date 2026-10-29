# Navigation and screen inventory

**Status:** Proposed. **Owner:** UX architect. **Related:** PLT-001, PRJ-001, MED-001, EDT-001/002, EXP-001, COL-001. **Dependencies:** [screen specifications](screen-by-screen-specifications.md).

| Surface | Purpose and main actions | Critical states |
|---|---|---|
| Public and authentication | Sign up, verify, sign in, reset | Invalid/expired token, locked session, accessible errors |
| Workspace dashboard | Switch workspaces; create/open/search projects | Empty, loading, denied, archived |
| Project settings | Name, canvas, frame rate, deletion/restore | Invalid dimensions, revision conflict |
| Media library | Upload, search, select, relink assets | Upload paused, ingest failed, proxy pending, missing |
| Quick editor | Seven guided stages and preview | Unsaved, hidden advanced content, approximate preview |
| Pro editor | Timeline, monitor, inspector, panels | Track locked, offline, unsupported live effect |
| Captions/transcript | Generate/import, correct text and times | Consent, provider failure, low confidence, invalid cue |
| Thumbnail | Compose canvas and export image | Missing image/font, low contrast, unsupported dimensions |
| Export/job history | Settings, submit, progress, cancel, download | Quota denied, queued, verifying, failed, expired artifact |
| Review | Authorized revision and timecoded comments | Expired/revoked link, unavailable revision |
| Workspace administration | Members, invitations, roles, quotas, audit | Last-owner guard, expired invite, denied access |
| Profile and billing | Profile, sessions, usage, billing | Separate authorization and error recovery |

Persistent breadcrumb identifies workspace and project; editor has labeled mode switch and save indicator. Browser back navigation cannot silently discard unsaved edits. Destructive actions require confirmation only when consequential and clearly state recoverability. Deep links pass server authorization; page visibility does not constitute permission. Acceptance: every listed state has a label, keyboard path and recovery destination, and view-only users never see enabled mutation controls.
