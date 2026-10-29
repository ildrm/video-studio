# Source audit and provenance

Status: partial • Owner: documentation architect • Inspected 2026-10-29. This is a new product specification. Research does not establish implemented functionality. No source media processing, upstream tests, platform performance benchmarks or legal clearance were performed.

| Source | Evidence used | Inspection and confidence | Limits |
|---|---|---|---|
| [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html), [FFprobe](https://ffmpeg.org/ffprobe.html) | Filter availability varies by build; probing inspects stream/container metadata. | 2026-10-29; official documentation, high for documented behavior | Deployed FFmpeg build and codecs not tested. |
| [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API), [Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) | Browser media APIs inform preview feasibility. | 2026-10-29; technical documentation, medium for actual browser behavior | Browser/device/codec combinations require tests. |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Proposed accessibility target and manual validation basis. | 2026-10-29; standards source, high | Conformance not assessed. |
| [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) | Defense-in-depth tenant isolation design. | 2026-10-29; official documentation, high | Deployment policy and bypass behavior require validation. |
| Local processing toolkit documentation and contract | Tool names, declared verification policies and technical feasibility; see [audit](../05-media-processing/ffmpeg-skill-42-tool-audit.md). | 2026-10-29; unpinned documentation notes, low; not independently reproducible from this register | Exact revision not pinned; no tool invocation or integration verified. |
| Workspace `LICENSE` | Existing license text observed. | 2026-10-29; direct file, high | Legal interpretation and third-party rights unresolved. |

Current platform, vendor, codec, accessibility and license requirements must be revalidated before implementation and release. Source claims are subordinate to reproducible tests of the actual deployed build. The register deliberately avoids treating third-party software as a product baseline.

## Sources checked during review

- [HTTP semantics, If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1): revised stale saves to 412 and distinguished missing preconditions.
- [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html) and [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/json-schema-core): structural API/schema validation basis. The contract declares OAS 3.1.0; patch-version guidance is used without claiming newer optional features.
- [Object upload integrity](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html): distinguished multipart ETag from full-object checksum; selected storage adapters still require their own compatibility tests.
- [Browser storage security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#storage-apis) and [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource): corrected recovery-cache assumptions and cookie-authenticated SSE.

Inspected 2026-10-29; these are primary technical/standards sources, not deployment test results. Unpinned toolkit rows remain research leads, not verified contract facts. The lack of a reproducible version/source locator is an explicit provenance gap; do not turn the declared 42 names into a runtime-verified count.
