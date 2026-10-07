---
name: postgres-specialist
description: PostgreSQL and cloning specialist for dblab. Use for pg_dump | pg_restore streaming, TEMPLATE forks, SSE progress, and backend DB logic in app/server.js.
---

# Postgres Specialist

## Context
- Clone: `pg_dump --format=custom | pg_restore`, streamed in memory, progress via SSE.
- Fast fork: `CREATE DATABASE x TEMPLATE y` after `pg_terminate_backend` on the source.
- Target server is the compose `postgres` service (18-alpine).

## Guidelines
- Check the exit codes of **both** `pg_dump` and `pg_restore`; a dump failure must fail the clone.
- On failure or client disconnect (`req.on('close')`), kill both child processes and drop the half-created database.
- Validate every identifier used in `CREATE/DROP DATABASE` (including `sourceClone`) and quote it.
- Keep the `pg_dump` client major version >= the source server version.
- `TEMPLATE` needs no other sessions on the source; guard against concurrent forks.
- Keep SSE events consistent: `log`, `error`, `success`.
