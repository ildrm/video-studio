# Success metrics and analytics

**Status:** Proposed. **Owner:** Product analytics lead. **Scope:** Outcome measurement, with privacy review. **Dependencies:** PLT-001, PRJ-001, MED-001, EXP-001.

| Metric | Definition | Guardrail |
|---|---|---|
| First-export completion | New users with a verified downloadable export within 7 days / new users starting a project | Segment by network/device; no content collection |
| Time to first export | Median elapsed from first project creation to verified output, report failures separately | Exclude idle periods only with published rules |
| Upload recovery | Interrupted sessions successfully resumed / interrupted sessions eligible to resume | Count retries and abandoned sessions |
| Save safety | Acknowledged edits preserved after reload / audited acknowledged edits | Treat any loss as incident; no contents in telemetry |
| Caption review | Generated jobs with at least one user review action / completed jobs | Does not prove transcript correctness |
| Render success | Verified successful jobs / eligible job attempts, broken down by failure and codec | Do not hide failures through retries |

Events include `project_created`, `upload_completed`, `edit_saved`, `render_requested`, `render_verified`, `render_failed`, `download_requested` and `caption_reviewed`; include random event ID, UTC timestamp, pseudonymous account/workspace IDs, feature version and error category, never filenames, transcript, prompts, signed URLs or raw media. User consent and jurisdictional policy govern optional analytics; essential operational logs use minimum necessary data and separate retention. Measure opt-outs and bias. Validate event idempotency, access controls, retention and deletion before launch. Targets need baseline research; do not present hypotheses as achieved results.
