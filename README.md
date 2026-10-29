# Video Studio

Video Studio is a browser-based video editing application under development. The current foundation includes a Next.js interface, a TypeScript API, PostgreSQL persistence and a Python/FFmpeg media worker. Detailed product and architecture specifications are in [docs/README.md](docs/README.md).

The current development workflow supports project search, rename, copy, archive/restore, video/audio ingestion, clip trimming/splitting/reordering, source and background audio, a two-clip dissolve, manual captions, autosave, and verified MP4 export in three canvas formats. Play a verified rendered revision to review the full composition. The selected-source preview gives approximate caption placement. See the [implementation checkpoint](docs/11-implementation/README.md) for precise verification and remaining scope.

Autosave waits one second after an edit and preserves later edits while a save is in flight. Revision conflicts require an explicit choice. Local draft recovery is optional and stores project text and edits on the current device, scoped to the signed-in account, workspace and project; entries expire after seven days and are cleared on sign-out. The editor explains this before enabling local storage.

## Local development with Docker Compose

You need Docker with Compose, a working Docker daemon, and enough storage for uploaded media and generated files. This configuration binds published ports to `127.0.0.1` and is intended for a single trusted developer machine.

1. Copy the example configuration and edit `.env`:

   ```sh
   cp .env.example .env
   ```

   Set `POSTGRES_PASSWORD` and `SESSION_SECRET` to separate, freshly generated secrets of at least 32 characters. `openssl rand -hex 32` is one way to generate URL-safe values. Use hexadecimal for the PostgreSQL password because it is embedded in a connection URI. Never commit `.env`.

2. To use the current local sign-up and rendering workflow, explicitly set `AUTH_LOCAL_ENABLED=true` and `MEDIA_LOCAL_ENABLED=true` in `.env`. Local accounts use passwords created by the user; there are no seeded demo credentials. Local authentication and the embedded media supervisor are development-only and are not a production identity provider or an isolated cloud worker.

3. Start the stack:

   ```sh
   docker compose up --build
   ```

   Compose waits for PostgreSQL, applies the API database migration, starts the API and then starts the web app. Open <http://localhost:3000>. The API health endpoint is <http://localhost:4000/health>. PostgreSQL is available locally on port 5433 by default. Override `WEB_PORT`, `API_PORT` or `POSTGRES_PORT` in `.env` when needed; if the web port changes, update `APP_ORIGIN` to the exact browser origin too.

4. Create a local account in the interface, then create a workspace and project. Passwords require at least 12 characters. Media operations depend on FFmpeg and the development flags above. Add a video clip, open Captions, and enter text and whole-frame start/end positions to add manual captions. Caption end frames are exclusive. The Docker images supply DejaVu Sans and its preserved license notices; missing font/text-rendering capabilities produce an explicit unavailable error. Collaboration, AI, advanced editing, and production hardening remain tracked in the documentation.

Stop the stack with `docker compose down`. Named database and media volumes remain available for the next run.

## Run from the host

Install Node.js 22.18 or later through 26, npm, Python 3, PostgreSQL 17, FFmpeg and FFprobe. The API needs a reachable database and writable private storage. For a local database you may start only the Compose `db` service after configuring `.env`:

```sh
docker compose up -d db
npm ci
npm run build --workspace @studio/api
```

Export the variables from your local configuration in the API terminal. For example, with a URL-safe hexadecimal `POSTGRES_PASSWORD`:

```sh
set -a
. ./.env
set +a
export DATABASE_URL="postgresql://studio:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT:-5433}/studio"
export NODE_ENV=development
export STORAGE_ROOT="$PWD/var/media"
export MEDIA_WORK_ROOT="$PWD/var/media"
export MEDIA_WORKER_SCRIPT="$PWD/workers/media/media_worker.py"
mkdir -p "$STORAGE_ROOT"
npm run migrate
npm run dev:api
```

Wait for the database to become healthy before migration. In a second terminal, run `npm run dev:web`. By default, the web server forwards `/v1` requests to `http://127.0.0.1:4000`; set `API_URL` when the API listens elsewhere. If FFmpeg or FFprobe is installed in a nonstandard location, set `FFMPEG_PATH` and `FFPROBE_PATH` to their executable paths. Do not enable local authentication or the embedded media supervisor in production.

For host caption rendering, FFmpeg must include `drawtext`. Set `FONT_PATH` to a trusted DejaVu Sans TTF and `FONT_LICENSE_PATH` to its complete license notices. The default paths target Debian's `fonts-dejavu-core` package. Fonts are copied into immutable private workspace assets with exact checksums and notices; the caption panel links to those notices. See the [DejaVu license](https://dejavu-fonts.github.io/License.html). No font binary is committed to this repository.

## Checks

```sh
npm run build
npm run typecheck
npm test
npm run test:media
npm run test:contracts
npm run test:docs
```

`npm test` compiles and runs the API tests, runs web tests, and invokes the media worker test suite. Some integration checks require PostgreSQL and a functioning FFmpeg installation; unavailable dependencies must be reported as skipped or failed rather than treated as verified. The development API is not a production-ready substitute for OIDC, isolated processing, object storage, a durable distributed queue, or independently audited security controls.

`npm run test:stack` exercises HTTP through a running web app against a **disposable local stack**. Set `VERIFY_BASE_URL` (default `http://localhost:3001`) and `VERIFY_MEDIA_FIXTURE` to a synthetic Rec.709-tagged video of at least one second and at most 5 MiB. Optionally set `VERIFY_OUTPUT` to preserve the synthetic MP4. The script creates local test data and checks font installation, captions, save/render/download, byte ranges, lifecycle operations, and revoked access. It does not drive the browser interface.
