# Media upload and asset client

Status: proposed • Owner: frontend lead • Dependencies: [ingestion](../04-backend/upload-ingestion-and-processing.md).

File picker and drop create per-file upload sessions. Slice files according to server-issued part size; upload directly with scoped signed URLs, retry with backoff and resume using server part manifest. Persist only session IDs and local metadata, never permanent signed URLs. User explicitly reselects local file after reload and verifies size/hash before resume. Complete triggers server-side checksum and inspection; upload completion is not asset readiness. Show validating, processing, ready and failed with accessible progress; offer cancel/retry, codec warning and relink. Browser checks are convenience only; server validates bytes and quota. Limit parallel parts and avoid logging filenames or URLs. Acceptance: lost connection/resume, expired URL refresh and rejected media do not create a ready asset.
