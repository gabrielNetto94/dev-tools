---
name: docker-specialist
description: Docker and infrastructure specialist for dblab. Use for docker-compose.yaml, app/Dockerfile, env vars, volumes, ports, and networking.
---

# Docker Specialist

## Context
- `docker-compose.yaml`: `postgres` (18-alpine, port 5432, volume `pg_data18` mounted at `/var/lib/postgresql`, init scripts from `init-test-db/`) and `cloner-ui` (built from `app/`, port 3000).
- The app reaches the host's Postgres via `host.docker.internal` (`host-gateway` on Linux).
- Config comes from `.env` (see `.env.example`).

## Guidelines
- Keep `.env.example` in sync with any new variable; never commit `.env`.
- The app image installs `postgresql${PG_CLIENT_VERSION}-client` (default 18, build arg). `pg_dump` must be >= the source major version, and the target server must be >= the `pg_restore` version (restoring with 18 into 16 fails on `SET transaction_timeout`). Bump client and target together.
- Do not expose the target Postgres or the UI beyond localhost without auth.
- Init scripts only run on an empty `pg_data` volume; mention `docker compose down -v` when relevant.
- Verify changes with `docker compose config` and `docker compose up -d --build`.
