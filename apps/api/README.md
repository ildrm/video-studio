# API foundation

This service implements a **local development** slice: real password registration/login with salted scrypt hashes, PostgreSQL sessions and workspaces, scoped project/revision storage, checksum-verified resumable local uploads, FFprobe ingestion for video and audio, verified PNG thumbnails for video, authenticated byte-range preview, immutable revision render jobs, real FFmpeg worker execution, verified artifact storage and authorized downloads. It is not a production service. It refuses to start with `NODE_ENV=production` because the documented OIDC provider, production storage and worker sandbox are not yet implemented. It does not provide social login, password reset, real email verification, organization management, invitation roles, billing, proxies, waveforms, transcripts or AI. Accounts show `emailVerified: false`; local development mode explicitly allows unverified development accounts.

Requirements: Node 22+, PostgreSQL, Python, a functional compatible FFmpeg/FFprobe installation and the repository's media worker. Media execution is an in-process development supervisor, not the documented isolated cloud queue. Production authorization, object storage, storage quotas, end-to-end crash cleanup, provider integration, worker sandboxing, deployment-wide admission controls, richer timeline semantics, and exhaustive checks remain work to complete before deployment.

From the repository root, install dependencies using the root lockfile, configure an isolated PostgreSQL database, then:

```sh
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/studio
export SESSION_SECRET='replace-with-at-least-32-random-characters'
export NODE_ENV=development AUTH_LOCAL_ENABLED=true MEDIA_LOCAL_ENABLED=true
export APP_ORIGIN=http://localhost:3000 API_HOST=127.0.0.1 PORT=4000
export STORAGE_ROOT=/tmp/studio-storage MEDIA_WORK_ROOT=/tmp/studio-work
export MEDIA_WORKER_SCRIPT="$(pwd)/workers/media/media_worker.py"
npm --prefix apps/api run build
npm --prefix apps/api run migrate
npm --prefix apps/api run start
```

`GET /health` checks PostgreSQL connectivity. The browser app uses a same-origin proxy for `/v1`. Registration and login take `{email,password,displayName}` and return a session, CSRF token and HttpOnly local cookie. Mutations require the configured `Origin`, `X-CSRF-Token`, and an `Idempotency-Key` where documented. Only workspace owners may currently access workspace resources; foreign tenant resources are denied. Revision saves require `If-Match: "rev-N"` and retain immutable prior versions.

The local identity adapter admits at most four concurrent password operations, 30 attempts per connection address per minute, and 10 attempts per email per minute. It uses the actual socket address rather than untrusted forwarding headers, hashes bucket identities, limits retained buckets, and returns `429 AUTH_RATE_LIMITED` with `Retry-After`. These in-memory safeguards reset on restart and are not a distributed identity gateway. Request bodies must be JSON objects; invalid primitives, arrays and null produce a structured 400 response.

Projects support `PATCH /v1/workspaces/{workspaceId}/projects/{projectId}` with `{name?, archived?}` and an idempotency key. Archive preserves revisions and referenced assets; restore uses `{archived:false}`. Archived projects are hidden from open, save and new render admission. Project lists accept `archived=true|false` and a case-insensitive literal `q` search, with cursors bound to these filters. `POST .../projects/{projectId}/duplicate` takes `{name}` and creates an independent revision-zero project from the latest saved document while reusing its immutable asset references. `POST .../projects/{projectId}/validate` takes `{document}` and returns `{valid:true,currentRevision}` after canonical schema and tenant checks without saving; a stale but valid draft still needs the ordinary save precondition. All routes require current owner authorization and mutation CSRF checks.

Manual captions can register the trusted font with `POST /v1/workspaces/{workspaceId}/fonts`, `{fontId:"dejavu-sans"}` and an idempotency key. This returns a ready immutable font asset; repeated registrations reuse the matching checksum. `FONT_PATH` defaults to `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf` and `FONT_LICENSE_PATH` to `/usr/share/doc/fonts-dejavu-core/copyright`; both must exist, otherwise the route returns `503 FONT_UNAVAILABLE`. The exact font notice is preserved in `metadata.licenseText` and served through the authorized `GET .../assets/{assetId}/license` route. Caption rendering requires a real FFmpeg build with text shaping/drawtext support. No arbitrary client font path or uploaded font execution is supported.

Migrations run under a PostgreSQL advisory lock, record checksums in `schema_migrations`, and commit each schema change and checksum atomically. A changed previously applied file fails; add a new migration instead. Existing databases created before the ledger receive one idempotent replay to establish their records.

Uploads split files into five MiB chunks, using signed, user-bound local part grants and SHA-256 verification. Before probing, asset kind is `unknown`; a successful probe assigns `video` or `audio`. A ready video has a verified PNG thumbnail. A ready audio-only asset has `metadata.video: null`, source timing under `metadata.audio`, no video thumbnail, and an audio content type derived from its probed container. Preview serves the original media with authenticated HTTP Range requests; this is not a generated proxy. The supported input formats and currently renderable track/effect combinations are limited to those listed by the worker; a ready source is not a guarantee that every edit can render. Local job execution is restricted to a single worker at a time, with an expiring DB lease and process timeout; restart recovery fences stale leases, reconciles cancelled/exhausted ingest assets, and cleans expired upload and worker staging files. An idle-tenant sweeper removes unreferenced staged copies after a two-hour grace period; worker support is limited to the operations in `workers/media/README.md`. Version-1 SDR presets are `portrait-sdr-mp4` (1080×1920), `landscape-sdr-mp4` (1920×1080), and `square-sdr-mp4` (1080×1080). Each requires the project canvas to match and uses the worker’s H.264/AAC output. Final artifacts are SHA-256 checked after worker verification. The sweeper and local supervisor are best-effort development mechanisms; orphaned OS processes after a controller crash can run until their own timeout, and active downloads already authorized before revocation may finish. Production sandbox guarantees and exactly-once execution are not claimed.

Run database integration tests against a disposable database **after migrating it**:

```sh
npm --prefix apps/api run build
npm --prefix apps/api run test:compile
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/studio_test npm --prefix apps/api run test
```

Set `TEST_MEDIA_FIXTURE` to a compatible, tagged Rec.709 MP4 to run the optional real-media integration case; set `TEST_AUDIO_FIXTURE` to a two-second, 48 kHz PCM WAV to exercise audio ingestion and `TEST_AUDIO_MIX=true` to verify a real mixed render. Set the trusted font and license paths above and `TEST_CAPTIONS=true` to verify font registration, notices, canonical caption saves, and real rendered text pixels. Configure `FFMPEG_PATH` and `FFPROBE_PATH` if the executables are not on PATH. The tests create uniquely named accounts/workspaces and check lifecycle responses against the OpenAPI Project and Asset schemas. They require network access to the local PostgreSQL and HTTP listener. Do not point them at production data.
